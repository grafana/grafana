package team

import (
	"context"
	"errors"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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
	listOnlyStorage
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
		{"ordinary reader", "", false, authlib.TypeUser},
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
			s, err := NewListOnlyStore(f, access, d, hiddenLogins)
			require.NoError(t, err)
			obj, err := s.(rest.Lister).List(ctx, nil)
			require.NoError(t, err)
			list := obj.(*iam.TeamList)
			require.Equal(t, f.teams.ListMeta, list.ListMeta)
			policy := tc.callerType == authlib.TypeAccessPolicy
			if policy {
				require.Len(t, access.compiles, 2)
				require.Len(t, d.batches, 1)
			} else {
				require.Empty(t, access.compiles)
				require.Empty(t, d.batches)
			}
			require.Len(t, list.Items, 2)
			for i, item := range list.Items {
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
			s, err := NewListOnlyStore(f, &rosterAccess{compileErr: tc.access}, &rosterDirectory{err: tc.directory}, tc.settings)
			require.NoError(t, err)
			obj, err := s.(rest.Lister).List(ctx, nil)
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
	store, err := NewListOnlyStore(f, access, &rosterDirectory{}, hiddenLogins)
	require.NoError(t, err)
	obj, err := store.(rest.Lister).List(ctx, nil)
	require.NoError(t, err)
	items := obj.(*iam.TeamList).Items
	require.Equal(t, item.Spec.Members, items[0].Spec.Members)
	require.Empty(t, items[1].Spec.Members)
	require.Len(t, access.compiles, 4)
	obj, err = store.(rest.Lister).List(request.WithNamespace(ctx, "stacks-1"), nil)
	require.Error(t, err)
	require.Nil(t, obj)
}

func TestRosterUserLookupBatches(t *testing.T) {
	item := iam.Team{ObjectMeta: metav1.ObjectMeta{Name: "oncall", Namespace: "stacks-1"}}
	for i := range 501 {
		item.Spec.Members = append(item.Spec.Members, iam.TeamTeamMember{Kind: "User", Name: fmt.Sprint(i)})
	}
	d := &rosterDirectory{}
	s, err := NewListOnlyStore(&teamReadFixture{teams: &iam.TeamList{Items: []iam.Team{item, item}}}, &rosterAccess{}, d, hiddenLogins)
	require.NoError(t, err)
	obj, err := s.(rest.Lister).List(identity.WithRequester(t.Context(), &identity.StaticRequester{Type: authlib.TypeAccessPolicy, Namespace: "stacks-1"}), nil)
	require.NoError(t, err)
	require.Equal(t, []int{500, 1}, d.batches)
	for _, team := range obj.(*iam.TeamList).Items {
		require.Equal(t, item.Spec.Members, team.Spec.Members)
	}
}
