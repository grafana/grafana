package team

import (
	"context"
	"errors"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iam "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type rosterAccess struct {
	authlib.AccessClient
	compiles   []authlib.ListRequest
	compileErr error
}

func (a *rosterAccess) Compile(_ context.Context, _ authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	a.compiles = append(a.compiles, req)
	if a.compileErr != nil {
		return nil, nil, a.compileErr
	}
	return func(name, _ string) bool {
		if req.Group != iam.GROUP {
			return false
		}
		if req.Resource == "users" {
			return req.Verb == utils.VerbList && name != "denied"
		}
		return req.Resource == "teams" && req.Verb == utils.VerbGetPermissions && req.Namespace == "stacks-1" && name == "oncall"
	}, authlib.NoopZookie{}, nil
}

type teamReadFixture struct {
	grafanarest.Storage
	teams *iam.TeamList
}

func (f *teamReadFixture) List(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
	return f.teams, nil
}

type rosterDirectory struct {
	legacy.LegacyIdentityStore
	batches []int
	err     error
}

func (d *rosterDirectory) ListDisplay(ctx context.Context, ns authlib.NamespaceInfo, q legacy.ListDisplayQuery) (*legacy.ListUserResult, error) {
	if request.NamespaceValue(ctx) != ns.Value {
		return nil, fmt.Errorf("wrong namespace")
	}
	d.batches = append(d.batches, len(q.UIDs))
	res := &legacy.ListUserResult{}
	for _, uid := range q.UIDs {
		if uid != "deleted" {
			res.Items = append(res.Items, common.UserWithRole{User: user.User{UID: uid, Login: uid + "-login", IsServiceAccount: uid == "service"}})
		}
	}
	return res, d.err
}

func hiddenLogins(context.Context) (map[string]struct{}, error) {
	return map[string]struct{}{"hidden-login": {}}, nil
}

func TestTeamMembershipScope(t *testing.T) {
	member := iam.TeamTeamMember{Kind: "User", Name: "sam", Permission: iam.TeamTeamPermissionAdmin}
	oncall := iam.Team{
		ObjectMeta: metav1.ObjectMeta{
			Name: "oncall", Namespace: "stacks-1", Annotations: map[string]string{"last-applied": "private roster"},
			ManagedFields: []metav1.ManagedFieldsEntry{{Manager: "test"}},
		},
		Spec: iam.TeamSpec{
			Title: "Team", Email: "team@example.org", ExternalUID: "team-id", ExternalGroups: []string{"private"},
			Members: []iam.TeamTeamMember{
				member, {Kind: "User", Name: "denied"}, {Kind: "User", Name: "deleted"}, {Kind: "User", Name: "hidden"},
				{Kind: "User", Name: "service"}, {Kind: "Team", Name: "sam"},
			},
		},
	}
	other := oncall
	other.Name = "other"
	f := &teamReadFixture{teams: &iam.TeamList{ListMeta: metav1.ListMeta{ResourceVersion: "8", Continue: "next"}, Items: []iam.Team{oncall, other}}}
	raw := f.teams.DeepCopy()
	for _, tc := range []struct {
		name, login string
		admin       bool
		callerType  authlib.IdentityType
	}{
		{"team-scoped reader", "", false, authlib.TypeUser},
		{"Grafana service account", "service", false, authlib.TypeServiceAccount},
		{"Grafana admin", "admin", true, authlib.TypeUser},
		{"access policy with same login", "hidden-login", false, authlib.TypeAccessPolicy},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Namespace: "stacks-1", Type: tc.callerType, Login: tc.login, IsGrafanaAdmin: tc.admin,
				Permissions: map[int64]map[string][]string{0: {accesscontrol.ActionOrgUsersRead: {"users:*"}, accesscontrol.ActionTeamsPermissionsRead: {"teams:*"}}},
			})
			access := &rosterAccess{}
			d := &rosterDirectory{}
			s := NewRosterStore(f, access, d, hiddenLogins)
			obj, err := s.List(ctx, nil)
			require.NoError(t, err)
			list := obj.(*iam.TeamList)
			require.Equal(t, f.teams.ListMeta, list.ListMeta)
			policy := tc.callerType == authlib.TypeAccessPolicy
			if policy {
				require.Len(t, access.compiles, 2)
				require.Len(t, d.batches, 1)
			} else {
				require.Len(t, access.compiles, 1)
				require.Empty(t, d.batches)
			}
			require.Len(t, list.Items, 2)
			for i, item := range list.Items {
				if i == 0 && !policy {
					require.Equal(t, oncall, item)
					continue
				}
				want := oncall.Spec
				want.ExternalGroups = nil
				want.Members = []iam.TeamTeamMember{}
				if i == 0 && policy {
					want.Members = append(want.Members, member)
				}
				require.Equal(t, want, item.Spec)
				require.Nil(t, item.ManagedFields)
				require.Nil(t, item.Annotations)
			}
			require.Equal(t, raw, f.teams)
		})
	}
}

func TestRosterLookupFailure(t *testing.T) {
	item := iam.Team{ObjectMeta: metav1.ObjectMeta{Name: "oncall", Namespace: "stacks-1"}, Spec: iam.TeamSpec{Members: []iam.TeamTeamMember{{Kind: "User", Name: "sam"}}}}
	f := &teamReadFixture{teams: &iam.TeamList{Items: []iam.Team{item}}}
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"})
	failure := errors.New("lookup failed")
	for _, tc := range []struct {
		name              string
		access, directory error
		settings          func(context.Context) (map[string]struct{}, error)
	}{
		{"authz", failure, nil, hiddenLogins}, {"users", nil, failure, hiddenLogins}, {"settings", nil, nil, func(context.Context) (map[string]struct{}, error) { return nil, failure }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := NewRosterStore(f, &rosterAccess{compileErr: tc.access}, &rosterDirectory{err: tc.directory}, tc.settings)
			obj, err := s.List(ctx, nil)
			require.Nil(t, obj)
			require.ErrorIs(t, err, failure)
		})
	}
}

func TestRosterListChecksEachNamespace(t *testing.T) {
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "*"})
	item := iam.Team{
		ObjectMeta: metav1.ObjectMeta{Namespace: "stacks-1", Name: "oncall"},
		Spec:       iam.TeamSpec{Members: []iam.TeamTeamMember{{Kind: "User", Name: "sam"}}},
	}
	other := item
	other.Namespace = "stacks-2"
	f := &teamReadFixture{teams: &iam.TeamList{Items: []iam.Team{item, other}}}
	access := &rosterAccess{}
	store := NewRosterStore(f, access, &rosterDirectory{}, hiddenLogins)
	obj, err := store.List(ctx, nil)
	require.NoError(t, err)
	items := obj.(*iam.TeamList).Items
	require.Equal(t, item.Spec.Members, items[0].Spec.Members)
	require.Empty(t, items[1].Spec.Members)
	require.Len(t, access.compiles, 4)
	obj, err = store.List(request.WithNamespace(ctx, "stacks-1"), nil)
	require.Error(t, err)
	require.Nil(t, obj)
}

func TestRosterUserLookupBatches(t *testing.T) {
	item := iam.Team{ObjectMeta: metav1.ObjectMeta{Name: "oncall", Namespace: "stacks-1"}}
	for i := range 501 {
		item.Spec.Members = append(item.Spec.Members, iam.TeamTeamMember{Kind: "User", Name: fmt.Sprint(i)})
	}
	d := &rosterDirectory{}
	s := NewRosterStore(&teamReadFixture{teams: &iam.TeamList{Items: []iam.Team{item, item}}}, &rosterAccess{}, d, hiddenLogins)
	obj, err := s.List(identity.WithRequester(t.Context(), &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"}), nil)
	require.NoError(t, err)
	require.Equal(t, []int{500, 1}, d.batches)
	for _, team := range obj.(*iam.TeamList).Items {
		require.Equal(t, item.Spec.Members, team.Spec.Members)
	}
}

type watchFixture struct {
	*teamReadFixture
	stream watch.Interface
}

func (f *watchFixture) Watch(context.Context, *internalversion.ListOptions) (watch.Interface, error) {
	return f.stream, nil
}

func (f *teamReadFixture) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	return &f.teams.Items[0], nil
}

func TestRosterGetAndWatch(t *testing.T) {
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"})
	item := iam.Team{ObjectMeta: metav1.ObjectMeta{Name: "oncall", Namespace: "stacks-1", ResourceVersion: "5"}, Spec: iam.TeamSpec{Members: []iam.TeamTeamMember{{Kind: "User", Name: "sam"}, {Kind: "User", Name: "hidden"}}}}
	inner := &teamReadFixture{teams: &iam.TeamList{Items: []iam.Team{item}}}
	access := &rosterAccess{}
	store := NewRosterStore(inner, access, &rosterDirectory{}, hiddenLogins)
	_, watches := store.(rest.Watcher)
	require.False(t, watches)
	got, err := store.Get(ctx, item.Name, nil)
	require.NoError(t, err)
	require.Equal(t, item.Spec.Members[:1], got.(*iam.Team).Spec.Members)
	stream := watch.NewRaceFreeFake()
	store = NewRosterStore(&watchFixture{inner, stream}, access, &rosterDirectory{}, hiddenLogins)
	w, err := store.(rest.Watcher).Watch(ctx, nil)
	require.NoError(t, err)
	defer w.Stop()
	for _, kind := range []watch.EventType{watch.Added, watch.Modified, watch.Deleted} {
		stream.Action(kind, &item)
		ev := <-w.ResultChan()
		require.Equal(t, kind, ev.Type)
		require.Equal(t, got, ev.Object)
	}
	other := item
	other.Name = "other"
	stream.Modify(&other)
	denied := <-w.ResultChan()
	require.Equal(t, watch.Modified, denied.Type)
	require.Empty(t, denied.Object.(*iam.Team).Spec.Members)
	stream.Action(watch.Bookmark, &item)
	bookmark := <-w.ResultChan()
	require.Equal(t, watch.Bookmark, bookmark.Type)
	require.Empty(t, bookmark.Object.(*iam.Team).Spec.Members)
	require.Equal(t, item.ResourceVersion, bookmark.Object.(*iam.Team).ResourceVersion)
	access.compileErr = errors.New("authorization unavailable")
	got, err = store.Get(ctx, item.Name, nil)
	require.ErrorIs(t, err, access.compileErr)
	require.Nil(t, got)
	stream.Delete(&item)
	require.Equal(t, watch.Error, (<-w.ResultChan()).Type)
	_, open := <-w.ResultChan()
	require.False(t, open)
}
