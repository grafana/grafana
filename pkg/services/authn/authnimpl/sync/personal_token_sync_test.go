package sync

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestPersonalTokenScopeHook(t *testing.T) {
	owner := map[string][]string{"dashboards:read": {"dashboards:*"}, "dashboards:write": {"dashboards:*"}, "users.tokens:create": {"users:id:1"}}
	newIdent := func(id int64, scopes map[string][]string) *authn.Identity {
		return &authn.Identity{OrgID: 1, PersonalTokenID: id, PersonalTokenScopes: scopes,
			Permissions: map[int64]map[string][]string{1: owner}}
	}
	h := ProvidePersonalTokenScopeHook(func() bool { return false })

	t.Run("intersects and applies deny-list", func(t *testing.T) {
		id := newIdent(5, map[string][]string{"*": nil})
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Equal(t, map[string][]string{"dashboards:read": {"dashboards:*"}, "dashboards:write": {"dashboards:*"}}, id.Permissions[1])
	})
	t.Run("read-only token", func(t *testing.T) {
		id := newIdent(5, map[string][]string{"*:read": nil})
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Equal(t, map[string][]string{"dashboards:read": {"dashboards:*"}}, id.Permissions[1])
	})
	t.Run("no scopes grants nothing", func(t *testing.T) {
		id := newIdent(5, nil)
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Empty(t, id.Permissions[1])
	})
	t.Run("owner role and server admin are dropped", func(t *testing.T) {
		yes := true
		id := newIdent(5, map[string][]string{"*:read": nil})
		id.IsGrafanaAdmin = &yes
		id.OrgRoles = map[int64]org.RoleType{1: org.RoleAdmin}
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.False(t, id.GetIsGrafanaAdmin())
		require.Equal(t, org.RoleViewer, id.GetOrgRole(), "read-only token is a viewer, never an admin")
		require.False(t, id.HasRole(org.RoleEditor))
	})
	t.Run("token with write actions is capped at editor, viewer owner stays viewer", func(t *testing.T) {
		id := newIdent(5, map[string][]string{"dashboards:write": nil})
		id.OrgRoles = map[int64]org.RoleType{1: org.RoleAdmin}
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Equal(t, org.RoleEditor, id.GetOrgRole())
		id = newIdent(5, map[string][]string{"dashboards:write": nil})
		id.OrgRoles = map[int64]org.RoleType{1: org.RoleViewer}
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Equal(t, org.RoleViewer, id.GetOrgRole())
		id = newIdent(5, map[string][]string{"dashboards:read": nil})
		id.OrgRoles = map[int64]org.RoleType{1: org.RoleNone}
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Equal(t, org.RoleNone, id.GetOrgRole())
	})
	t.Run("admin actions allowed: wildcard token gets no admin rights", func(t *testing.T) {
		yes := true
		id := newIdent(5, map[string][]string{"*": nil})
		id.IsGrafanaAdmin = &yes
		id.OrgRoles = map[int64]org.RoleType{1: org.RoleAdmin}
		require.NoError(t, ProvidePersonalTokenScopeHook(func() bool { return true }).Hook(context.Background(), id, nil))
		require.False(t, id.GetIsGrafanaAdmin())
		require.NotEqual(t, org.RoleAdmin, id.GetOrgRole())
		require.NotContains(t, id.Permissions[1], "users.tokens:create")
	})
	t.Run("admin actions allowed still lowers role and admin flag for an explicit admin scope", func(t *testing.T) {
		yes := true
		id := newIdent(5, map[string][]string{"users.tokens:create": nil})
		id.IsGrafanaAdmin = &yes
		id.OrgRoles = map[int64]org.RoleType{1: org.RoleAdmin}
		require.NoError(t, ProvidePersonalTokenScopeHook(func() bool { return true }).Hook(context.Background(), id, nil))
		require.False(t, id.GetIsGrafanaAdmin())
		require.NotEqual(t, org.RoleAdmin, id.GetOrgRole())
		require.Contains(t, id.Permissions[1], "users.tokens:create")
	})
	t.Run("non-token identity untouched", func(t *testing.T) {
		id := newIdent(0, nil)
		require.NoError(t, h.Hook(context.Background(), id, nil))
		require.Equal(t, owner, id.Permissions[1])
	})
}
