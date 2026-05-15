package parity

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/team"
)

// Most of the comparator's value is in classify() — the right shape of
// outcome label given a (legacyTeam, legacyErr, k8sTeam, k8sErr) tuple.
// We exercise classify directly via a table; the shadow goroutine itself
// is tested separately by observing that the recording fake gets called.

func TestClassify(t *testing.T) {
	teamA := &team.TeamDTO{ID: 1, UID: "uid-a", OrgID: 1, Name: "a", Email: "a@example.com"}
	teamB := &team.TeamDTO{ID: 1, UID: "uid-a", OrgID: 1, Name: "a", Email: "a@example.com"}
	teamDifferent := &team.TeamDTO{ID: 1, UID: "uid-a", OrgID: 1, Name: "DIFFERENT", Email: "a@example.com"}

	errBoom := errors.New("boom")

	cases := []struct {
		name      string
		legacy    *team.TeamDTO
		legacyErr error
		k8s       *team.TeamDTO
		k8sErr    error
		want      string
	}{
		{"both equal", teamA, nil, teamB, nil, "match"},
		{"name differs", teamA, nil, teamDifferent, nil, "mismatch"},
		{"legacy error", nil, errBoom, teamB, nil, "legacy_error"},
		{"k8s error", teamA, nil, nil, errBoom, "k8s_error"},
		{"both error", nil, errBoom, nil, errBoom, "both_errors"},
		{"both nil result (no error)", nil, nil, nil, nil, "mismatch"},
		{"only legacy nil", nil, nil, teamB, nil, "missing_legacy"},
		{"only k8s nil", teamA, nil, nil, nil, "missing_k8s"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := classify(tc.legacy, tc.legacyErr, tc.k8s, tc.k8sErr)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestClassifyDelete(t *testing.T) {
	errGone := errors.New("not found")
	cases := []struct {
		name      string
		legacyErr error
		k8sErr    error
		want      string
	}{
		{"both gone", errGone, errGone, "match"},
		{"only legacy gone", errGone, nil, "missing_k8s"},
		{"only k8s gone", nil, errGone, "missing_legacy"},
		{"neither gone", nil, nil, "mismatch"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := classifyDelete(tc.legacyErr, tc.k8sErr)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestSemanticallyEqual(t *testing.T) {
	base := &team.TeamDTO{
		ID: 1, UID: "uid", OrgID: 1,
		Name: "a", Email: "a@example.com",
		ExternalUID: "ext-1", IsProvisioned: false,
	}

	t.Run("identical wins", func(t *testing.T) {
		other := *base
		assert.True(t, semanticallyEqual(base, &other))
	})

	t.Run("ID differs is OK (deprecated)", func(t *testing.T) {
		other := *base
		other.ID = 999
		assert.True(t, semanticallyEqual(base, &other),
			"ID equality is not part of the parity contract — the K8s adapter may legitimately return 0 (Bug A) and that should not produce a 'mismatch'; it should produce a separate signal via the non-zero ID assertion in the integration test")
	})

	t.Run("MemberCount differs is OK (separate concern)", func(t *testing.T) {
		other := *base
		other.MemberCount = 5
		assert.True(t, semanticallyEqual(base, &other))
	})

	t.Run("UID mismatch is a real mismatch", func(t *testing.T) {
		other := *base
		other.UID = "different"
		assert.False(t, semanticallyEqual(base, &other))
	})

	t.Run("Name mismatch is a real mismatch", func(t *testing.T) {
		other := *base
		other.Name = "different"
		assert.False(t, semanticallyEqual(base, &other))
	})

	t.Run("nil handling", func(t *testing.T) {
		assert.True(t, semanticallyEqual(nil, nil))
		assert.False(t, semanticallyEqual(base, nil))
		assert.False(t, semanticallyEqual(nil, base))
	})
}

// fakeTeamService is a minimal team.Service for testing the shadow goroutine
// without standing up the whole DI graph. Only the methods exercised by the
// comparator's write paths and read-back are non-trivial; the rest panic to
// catch accidental call paths.
//
// Why not use pkg/services/team/teamtest/FakeService? That helper is built
// around static "Expected*" fields and returns the same response for every
// call. The comparator's shadow goroutine needs different responses for the
// legacy and k8s services (to surface the divergence cases under test) plus
// per-call dispatch. A per-test fake is the minimum surface area to express
// that without bending teamtest into a different shape.
type fakeTeamService struct {
	mu       sync.Mutex
	createFn func(*team.CreateTeamCommand) (team.Team, error)
	updateFn func(*team.UpdateTeamCommand) error
	deleteFn func(*team.DeleteTeamCommand) error
	getFn    func(*team.GetTeamByIDQuery) (*team.TeamDTO, error)
	calls    []string
}

func (f *fakeTeamService) record(name string) {
	f.mu.Lock()
	f.calls = append(f.calls, name)
	f.mu.Unlock()
}

func (f *fakeTeamService) callLog() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, len(f.calls))
	copy(out, f.calls)
	return out
}

func (f *fakeTeamService) CreateTeam(_ context.Context, c *team.CreateTeamCommand) (team.Team, error) {
	f.record("CreateTeam")
	if f.createFn != nil {
		return f.createFn(c)
	}
	return team.Team{ID: 1, OrgID: c.OrgID, Name: c.Name, Email: c.Email}, nil
}
func (f *fakeTeamService) UpdateTeam(_ context.Context, c *team.UpdateTeamCommand) error {
	f.record("UpdateTeam")
	if f.updateFn != nil {
		return f.updateFn(c)
	}
	return nil
}
func (f *fakeTeamService) DeleteTeam(_ context.Context, c *team.DeleteTeamCommand) error {
	f.record("DeleteTeam")
	if f.deleteFn != nil {
		return f.deleteFn(c)
	}
	return nil
}
func (f *fakeTeamService) GetTeamByID(_ context.Context, q *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	f.record("GetTeamByID")
	if f.getFn != nil {
		return f.getFn(q)
	}
	return nil, errors.New("no getFn configured")
}
func (f *fakeTeamService) SearchTeams(context.Context, *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	panic("not exercised")
}
func (f *fakeTeamService) GetTeamsByUser(context.Context, *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	panic("not exercised")
}
func (f *fakeTeamService) GetTeamIDsByUser(context.Context, *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	panic("not exercised")
}
func (f *fakeTeamService) IsTeamMember(context.Context, int64, int64, int64) (bool, error) {
	panic("not exercised")
}
func (f *fakeTeamService) RemoveUsersMemberships(context.Context, int64) error {
	panic("not exercised")
}
func (f *fakeTeamService) GetUserTeamMemberships(context.Context, int64, int64, bool, bool) ([]*team.TeamMemberDTO, error) {
	panic("not exercised")
}
func (f *fakeTeamService) GetTeamMembers(context.Context, *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	panic("not exercised")
}
func (f *fakeTeamService) RegisterDelete(string) {}

func TestComparator_CreateTriggersShadowReadFromBothStores(t *testing.T) {
	primary := &fakeTeamService{}
	legacyReads := make(chan struct{}, 1)
	k8sReads := make(chan struct{}, 1)

	legacy := &fakeTeamService{
		getFn: func(q *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
			legacyReads <- struct{}{}
			return &team.TeamDTO{ID: q.ID, UID: "u1", OrgID: q.OrgID, Name: "n", Email: "e@x"}, nil
		},
	}
	k8s := &fakeTeamService{
		getFn: func(q *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
			k8sReads <- struct{}{}
			return &team.TeamDTO{ID: q.ID, UID: "u1", OrgID: q.OrgID, Name: "n", Email: "e@x"}, nil
		},
	}

	c := New(primary, legacy, k8s, StaticMode(1), func(context.Context) bool { return true }, log.NewNopLogger())

	_, err := c.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "n", Email: "e@x", OrgID: 1})
	require.NoError(t, err)

	// Shadow comparison runs in a goroutine — wait briefly for both reads.
	select {
	case <-legacyReads:
	case <-time.After(2 * time.Second):
		t.Fatal("legacy shadow read did not fire")
	}
	select {
	case <-k8sReads:
	case <-time.After(2 * time.Second):
		t.Fatal("k8s shadow read did not fire")
	}

	assert.Contains(t, primary.callLog(), "CreateTeam", "primary must serve the synchronous request")
}

func TestComparator_DisabledIsPureLPassthrough(t *testing.T) {
	primary := &fakeTeamService{}
	legacy := &fakeTeamService{
		getFn: func(*team.GetTeamByIDQuery) (*team.TeamDTO, error) {
			t.Fatal("legacy must not be read when comparator is disabled")
			return nil, nil
		},
	}
	k8s := &fakeTeamService{
		getFn: func(*team.GetTeamByIDQuery) (*team.TeamDTO, error) {
			t.Fatal("k8s must not be read when comparator is disabled")
			return nil, nil
		},
	}

	c := New(primary, legacy, k8s, StaticMode(1), func(context.Context) bool { return false }, log.NewNopLogger())

	_, err := c.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "n", OrgID: 1})
	require.NoError(t, err)

	// Give any (forbidden) goroutine a chance to misbehave.
	time.Sleep(50 * time.Millisecond)
}

func TestComparator_PrimaryErrorSkipsShadow(t *testing.T) {
	primary := &fakeTeamService{
		createFn: func(*team.CreateTeamCommand) (team.Team, error) {
			return team.Team{}, errors.New("primary failed")
		},
	}
	legacy := &fakeTeamService{
		getFn: func(*team.GetTeamByIDQuery) (*team.TeamDTO, error) {
			t.Fatal("shadow read must not run when the primary write failed — there is nothing to compare")
			return nil, nil
		},
	}
	k8s := &fakeTeamService{
		getFn: func(*team.GetTeamByIDQuery) (*team.TeamDTO, error) {
			t.Fatal("shadow read must not run when the primary write failed")
			return nil, nil
		},
	}

	c := New(primary, legacy, k8s, StaticMode(1), func(context.Context) bool { return true }, log.NewNopLogger())

	_, err := c.CreateTeam(context.Background(), &team.CreateTeamCommand{Name: "n", OrgID: 1})
	require.Error(t, err)
	time.Sleep(50 * time.Millisecond)
}
