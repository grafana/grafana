package resourcepermissions

import (
	"context"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

// benchNamespace parses to org 1.
const benchNamespace = "default"

// benchDB counts every simulated database round trip made while converting a
// ResourcePermission to the legacy DTO, and optionally charges each one a fixed
// latency. Round-trip count is the metric that matters: in production each is a
// separate serial DB session, so a free fake DB makes the batching look like a
// pure regression when it is the opposite.
type benchDB struct {
	queries atomic.Int64
	latency time.Duration
}

func (d *benchDB) hit() {
	d.queries.Add(1)
	if d.latency > 0 {
		time.Sleep(d.latency)
	}
}

type benchUserService struct {
	*usertest.FakeUserService
	db    *benchDB
	users map[string]*user.User
}

func (s *benchUserService) GetByUID(_ context.Context, q *user.GetUserByUIDQuery) (*user.User, error) {
	s.db.hit()
	u, ok := s.users[q.UID]
	if !ok {
		return nil, user.ErrUserNotFound
	}
	return u, nil
}

func (s *benchUserService) ListByIdOrUID(_ context.Context, uids []string, _ []int64) ([]*user.User, error) {
	s.db.hit()
	out := make([]*user.User, 0, len(uids))
	for _, uid := range uids {
		if u, ok := s.users[uid]; ok {
			out = append(out, u)
		}
	}
	return out, nil
}

type benchTeamService struct {
	*teamtest.FakeService
	db    *benchDB
	teams map[string]*team.TeamDTO
}

func (s *benchTeamService) GetTeamByID(_ context.Context, q *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	s.db.hit()
	t, ok := s.teams[q.UID]
	if !ok {
		return nil, team.ErrTeamNotFound
	}
	return t, nil
}

func (s *benchTeamService) SearchTeams(_ context.Context, q *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	s.db.hit()
	res := team.SearchTeamQueryResult{}
	for _, uid := range q.UIDs {
		if t, ok := s.teams[uid]; ok {
			res.Teams = append(res.Teams, t)
		}
	}
	res.TotalCount = int64(len(res.Teams))
	return res, nil
}

type benchStore struct {
	*mockResourcePermissionStore
	db  *benchDB
	ids map[string]int64
}

func (s *benchStore) GetPermissionIDByRoleName(_ context.Context, _ int64, roleName string) (int64, error) {
	s.db.hit()
	id, ok := s.ids[roleName]
	if !ok {
		return 0, fmt.Errorf("permission not found for role")
	}
	return id, nil
}

func (s *benchStore) GetPermissionIDsByRoleNames(_ context.Context, _ int64, roleNames []string) (map[string]int64, error) {
	s.db.hit()
	result := make(map[string]int64, len(roleNames))
	for _, roleName := range roleNames {
		if id, ok := s.ids[roleName]; ok {
			result[roleName] = id
		}
	}
	return result, nil
}

func (s *benchStore) GetServiceAccountsByUIDs(_ context.Context, _ int64, _ []string) ([]*user.User, error) {
	s.db.hit()
	return nil, nil
}

// benchFixture is a folder ResourcePermission with n entries plus the fakes that
// can resolve every subject it references.
type benchFixture struct {
	api  *api
	perm *iamv0.ResourcePermission
	db   *benchDB
}

// newBenchFixture builds an entry mix weighted like a large real folder ACL:
// mostly individual users, some teams, a couple of basic roles.
func newBenchFixture(n int, latency time.Duration) *benchFixture {
	db := &benchDB{latency: latency}

	users := make(map[string]*user.User, n)
	teams := make(map[string]*team.TeamDTO, n)
	ids := make(map[string]int64, n)
	perms := make([]iamv0.ResourcePermissionspecPermission, 0, n)

	verbs := []string{"view", "edit", "admin"}
	numTeams := n / 5
	numBasic := 2
	numUsers := n - numTeams - numBasic
	if numUsers < 0 {
		numUsers = 0
	}

	for i := 0; i < numUsers; i++ {
		uid := fmt.Sprintf("user-uid-%d", i)
		users[uid] = &user.User{
			ID:    int64(i + 1),
			UID:   uid,
			Login: fmt.Sprintf("user-%d", i),
			Email: fmt.Sprintf("user-%d@example.com", i),
		}
		ids[fmt.Sprintf("managed:users:%d:permissions", i+1)] = int64(1000 + i)
		perms = append(perms, iamv0.ResourcePermissionspecPermission{
			Kind: iamv0.ResourcePermissionSpecPermissionKindUser,
			Name: uid,
			Verb: verbs[i%len(verbs)],
		})
	}

	for i := 0; i < numTeams; i++ {
		uid := fmt.Sprintf("team-uid-%d", i)
		teams[uid] = &team.TeamDTO{
			ID:    int64(i + 1),
			UID:   uid,
			Name:  fmt.Sprintf("team-%d", i),
			Email: fmt.Sprintf("team-%d@example.com", i),
		}
		ids[fmt.Sprintf("managed:teams:%d:permissions", i+1)] = int64(2000 + i)
		perms = append(perms, iamv0.ResourcePermissionspecPermission{
			Kind: iamv0.ResourcePermissionSpecPermissionKindTeam,
			Name: uid,
			Verb: verbs[i%len(verbs)],
		})
	}

	for i, role := range []string{"Editor", "Viewer"}[:numBasic] {
		ids[fmt.Sprintf("managed:builtins:%s:permissions", strings.ToLower(role))] = int64(3000 + i)
		perms = append(perms, iamv0.ResourcePermissionspecPermission{
			Kind: iamv0.ResourcePermissionSpecPermissionKindBasicRole,
			Name: role,
			Verb: verbs[i%len(verbs)],
		})
	}

	a := &api{
		cfg:    setting.NewCfg(),
		logger: log.New("bench"),
		service: &Service{
			store: &benchStore{
				mockResourcePermissionStore: &mockResourcePermissionStore{},
				db:                          db,
				ids:                         ids,
			},
			userService: &benchUserService{
				FakeUserService: usertest.NewUserServiceFake(),
				db:              db,
				users:           users,
			},
			teamService: &benchTeamService{
				FakeService: teamtest.NewFakeService(),
				db:          db,
				teams:       teams,
			},
			options: Options{
				Resource:          folderv1.RESOURCE,
				ResourceAttribute: "uid",
				APIGroup:          folderv1.APIGroup,
				PermissionsToActions: map[string][]string{
					"View":  {"folders:read"},
					"Edit":  {"folders:read", "folders:write"},
					"Admin": {"folders:read", "folders:write", "folders:delete"},
				},
			},
		},
	}

	return &benchFixture{
		api: a,
		db:  db,
		perm: &iamv0.ResourcePermission{
			Spec: iamv0.ResourcePermissionSpec{
				Resource: iamv0.ResourcePermissionspecResource{
					ApiGroup: folderv1.APIGroup,
					Resource: folderv1.RESOURCE,
					Name:     "folder-uid",
				},
				Permissions: perms,
			},
		},
	}
}

func benchConvert(b *testing.B, n int, latency time.Duration) {
	f := newBenchFixture(n, latency)
	ctx := context.Background()

	// Fail fast if the fixture cannot resolve its own subjects.
	dto, err := f.api.convertK8sResourcePermissionToDTO(ctx, f.perm, benchNamespace, false)
	require.NoError(b, err)
	require.Len(b, dto, n)

	f.db.queries.Store(0)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := f.api.convertK8sResourcePermissionToDTO(ctx, f.perm, benchNamespace, false); err != nil {
			b.Fatal(err)
		}
	}
	b.StopTimer()

	b.ReportMetric(float64(f.db.queries.Load())/float64(b.N), "queries/op")
}

// BenchmarkConvertK8sResourcePermissionToDTO measures the in-process cost of
// turning one folder's ResourcePermission into the legacy DTO list, with a
// free fake DB. ns/op here is only the Go-side work; queries/op is the number
// of DB round trips the request would issue.
func BenchmarkConvertK8sResourcePermissionToDTO(b *testing.B) {
	for _, n := range []int{10, 100, 600} {
		b.Run(fmt.Sprintf("entries=%d", n), func(b *testing.B) {
			benchConvert(b, n, 0)
		})
	}
}

// BenchmarkConvertK8sResourcePermissionToDTOWithDBLatency charges every round
// trip a latency in the range a same-region Grafana-to-database hop costs. The
// lookups are serial, so this is where the round-trip count shows up as
// request latency.
func BenchmarkConvertK8sResourcePermissionToDTOWithDBLatency(b *testing.B) {
	const latency = 200 * time.Microsecond
	for _, n := range []int{100, 600} {
		b.Run(fmt.Sprintf("entries=%d", n), func(b *testing.B) {
			benchConvert(b, n, latency)
		})
	}
}
