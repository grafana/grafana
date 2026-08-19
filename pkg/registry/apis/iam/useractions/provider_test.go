package useractions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzstore "github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// nsCtx mimics the apiserver, which puts the request's namespace in the context.
func nsCtx(namespace string) context.Context {
	return k8srequest.WithNamespace(context.Background(), namespace)
}

type fakeActionStore struct {
	gotQuery ActionsQuery
	gotNs    claims.NamespaceInfo
	actions  []string
}

func (f *fakeActionStore) GetUserActions(_ context.Context, ns claims.NamespaceInfo, q ActionsQuery) ([]string, error) {
	f.gotNs, f.gotQuery = ns, q
	return f.actions, nil
}

type fakeIdentifierStore struct {
	ids  authzstore.UserIdentifiers
	role authzstore.BasicRole
}

func (f *fakeIdentifierStore) GetUserIdentifiers(_ context.Context, _ authzstore.UserIdentifierQuery) (*authzstore.UserIdentifiers, error) {
	return &f.ids, nil
}

func (f *fakeIdentifierStore) GetBasicRoles(_ context.Context, _ claims.NamespaceInfo, _ authzstore.BasicRoleQuery) (*authzstore.BasicRole, error) {
	return &f.role, nil
}

// fakeIdentityStore returns teams one page at a time so the paging loop is exercised.
type fakeIdentityStore struct {
	pages [][]int64
	calls int
}

func (f *fakeIdentityStore) ListUserTeams(_ context.Context, _ claims.NamespaceInfo, _ legacy.ListUserTeamsQuery) (*legacy.ListUserTeamsResult, error) {
	page := f.pages[f.calls]
	f.calls++
	res := &legacy.ListUserTeamsResult{}
	for _, id := range page {
		res.Items = append(res.Items, legacy.UserTeam{ID: id})
	}
	if f.calls < len(f.pages) {
		res.Continue = int64(f.calls)
	}
	return res, nil
}

func TestSQLProvider_ActionsForUser(t *testing.T) {
	t.Run("returns every granted action and passes the resolved identity to the store", func(t *testing.T) {
		actions := &fakeActionStore{actions: []string{"dashboards:read", "teams:create", "users:read"}}
		ids := &fakeIdentifierStore{
			ids:  authzstore.UserIdentifiers{ID: 7, UID: "u7"},
			role: authzstore.BasicRole{Role: "Editor", IsAdmin: true},
		}
		provider := NewSQLProvider(actions, ids, &fakeIdentityStore{pages: [][]int64{{1, 2}, {3}}}, nil)

		got, err := provider.ActionsForUser(nsCtx("default"), &user.SignedInUser{
			OrgID: 1, UserID: 7, UserUID: "u7", OrgRole: org.RoleEditor,
		}, Options{})
		require.NoError(t, err)
		require.Equal(t, map[string]bool{"dashboards:read": true, "teams:create": true, "users:read": true}, got)

		require.Equal(t, int64(7), actions.gotQuery.UserID)
		require.Equal(t, "Editor", actions.gotQuery.Role)
		require.True(t, actions.gotQuery.IsServerAdmin)
		require.Equal(t, []int64{1, 2, 3}, actions.gotQuery.TeamIDs, "must collect every page of teams")
		require.Equal(t, int64(1), actions.gotNs.OrgID)
	})

	// Multi-tenant addresses tenants as stacks-<id>, which resolves to org 1.
	t.Run("resolves a stacks namespace to org 1", func(t *testing.T) {
		actions := &fakeActionStore{actions: []string{"dashboards:read"}}
		ids := &fakeIdentifierStore{
			ids:  authzstore.UserIdentifiers{ID: 3, UID: "u3"},
			role: authzstore.BasicRole{Role: "Admin"},
		}
		provider := NewSQLProvider(actions, ids, &fakeIdentityStore{pages: [][]int64{nil}}, nil)

		got, err := provider.ActionsForUser(nsCtx("stacks-11"), &user.SignedInUser{OrgID: 1, UserID: 3, UserUID: "u3"}, Options{})
		require.NoError(t, err)
		require.Equal(t, map[string]bool{"dashboards:read": true}, got)
		require.Equal(t, int64(1), actions.gotNs.OrgID)
		require.Equal(t, int64(11), actions.gotNs.StackID)
	})

	t.Run("expands action sets when a resolver is configured", func(t *testing.T) {
		actions := &fakeActionStore{actions: []string{"folders:edit"}}
		provider := NewSQLProvider(actions, &fakeIdentifierStore{}, &fakeIdentityStore{pages: [][]int64{nil}}, expandFolderEdit{})

		got, err := provider.ActionsForUser(nsCtx("default"), &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "u1"}, Options{})
		require.NoError(t, err)
		require.Equal(t, map[string]bool{"folders:read": true, "dashboards:read": true}, got)
	})

	t.Run("identities that cannot hold RBAC assignments are rejected", func(t *testing.T) {
		actions := &fakeActionStore{actions: []string{"should:not:be:read"}}
		provider := NewSQLProvider(actions, &fakeIdentifierStore{}, &fakeIdentityStore{}, nil)

		// An access policy identity is neither a user nor a service account.
		_, err := provider.ActionsForUser(nsCtx("default"), &identity.StaticRequester{
			Type: claims.TypeAccessPolicy, OrgID: 1,
		}, Options{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})
}

// expandFolderEdit stands in for the action set service: it turns the
// folders:edit action set into the actions it represents.
type expandFolderEdit struct{ accesscontrol.ActionResolver }

func (expandFolderEdit) ExpandActionSets(permissions []accesscontrol.Permission) []accesscontrol.Permission {
	var out []accesscontrol.Permission
	for _, p := range permissions {
		if p.Action == "folders:edit" {
			out = append(out,
				accesscontrol.Permission{Action: "folders:read"},
				accesscontrol.Permission{Action: "dashboards:read"},
			)
			continue
		}
		out = append(out, p)
	}
	return out
}
