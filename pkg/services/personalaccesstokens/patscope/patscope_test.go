package patscope

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEffective(t *testing.T) {
	owner := map[string][]string{
		"dashboards:read":     {"dashboards:*", "folders:uid:a"},
		"dashboards:write":    {"dashboards:uid:abc"},
		"folders:read":        {"folders:*"},
		"datasources:read":    {"datasources:*"},
		"users:write":         {"users:*"},
		"users.tokens:create": {"users:id:1"},
		"org.status:read":     {},
	}

	tests := []struct {
		name  string
		scope Scopes
		admin bool
		want  map[string][]string
	}{
		{"nil scopes grant nothing", nil, false, map[string][]string{}},
		{"exact action inherits owner scopes", Scopes{"folders:read": nil}, false,
			map[string][]string{"folders:read": {"folders:*"}}},
		{"read-only preset", Scopes{"*:read": nil}, false, map[string][]string{
			"dashboards:read":  {"dashboards:*", "folders:uid:a"},
			"folders:read":     {"folders:*"},
			"datasources:read": {"datasources:*"},
			"org.status:read":  {},
		}},
		{"token cannot gain action owner lacks", Scopes{"alert.rules:write": nil}, false, map[string][]string{}},
		{"narrower token scope wins", Scopes{"dashboards:read": {"dashboards:uid:x"}}, false,
			map[string][]string{"dashboards:read": {"dashboards:uid:x"}}},
		{"narrower owner scope wins", Scopes{"dashboards:write": {"dashboards:*"}}, false,
			map[string][]string{"dashboards:write": {"dashboards:uid:abc"}}},
		{"disjoint scopes leave no access", Scopes{"folders:read": {"datasources:*"}}, false,
			map[string][]string{}},
		{"deny-list blocks even with wildcard", Scopes{"*": nil}, false, map[string][]string{
			"dashboards:read":  {"dashboards:*", "folders:uid:a"},
			"dashboards:write": {"dashboards:uid:abc"},
			"folders:read":     {"folders:*"},
			"datasources:read": {"datasources:*"},
			"org.status:read":  {},
		}},
		{"deny-list can be lifted by admin setting", Scopes{"users:write": nil}, true,
			map[string][]string{"users:write": {"users:*"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, Effective(owner, tt.scope, tt.admin))
		})
	}
}

func TestEffectiveReflectsOwnerDowngrade(t *testing.T) {
	scopes := Scopes{"dashboards:write": nil}
	require.Contains(t, Effective(map[string][]string{"dashboards:write": {"dashboards:*"}}, scopes, false), "dashboards:write")
	require.Empty(t, Effective(map[string][]string{"dashboards:read": {"dashboards:*"}}, scopes, false))
}

func TestEffectiveNeverExceedsOwner(t *testing.T) {
	owner := map[string][]string{"a:read": {"x:1"}, "b:read": {"y:*"}}
	for _, s := range []Scopes{{"*": nil}, {"*": {"*"}}, {"a:read": {"x:*", "z:1"}}, {"b:*": {"y:2", "q:*"}}} {
		for action, scopes := range Effective(owner, s, false) {
			ownerScopes, ok := owner[action]
			require.True(t, ok, action)
			for _, sc := range scopes {
				found := false
				for _, o := range ownerScopes {
					found = found || covers(o, sc)
				}
				require.True(t, found, "%s %s exceeds owner", action, sc)
			}
		}
	}
}

func TestValidateRequested(t *testing.T) {
	owner := map[string][]string{"dashboards:read": {"dashboards:*"}, "users:write": {"users:*"}}
	require.NoError(t, ValidateRequested(owner, Scopes{"dashboards:read": nil}, false))
	require.NoError(t, ValidateRequested(owner, Scopes{"*:read": nil}, false))
	require.ErrorIs(t, ValidateRequested(owner, Scopes{"alert.rules:read": nil}, false), ErrInvalidScopes)
	require.ErrorIs(t, ValidateRequested(owner, Scopes{"users:write": nil}, false), ErrInvalidScopes)
	require.NoError(t, ValidateRequested(owner, Scopes{"users:write": nil}, true))
	require.ErrorIs(t, ValidateRequested(owner, Scopes{"": nil}, false), ErrInvalidScopes)
	require.ErrorIs(t, ValidateRequested(owner, Scopes{"[": nil}, false), ErrInvalidScopes)
}

func TestIsDeniedAction(t *testing.T) {
	for _, a := range []string{"users.tokens:create", "users.tokens:delete", "serviceaccounts:create", "users.password:write", "org.users:add", "settings:write",
		"folders.permissions:write", "dashboards.permissions:write", "datasources.permissions:write", "teams.permissions:write",
		"teams:create", "teams:write", "teams:delete", "roles:write", "roles:delete", "users.roles:add", "users.roles:remove",
		"teams.roles:add", "teams.roles:remove", "orgs:create", "orgs:write", "orgs:delete",
		"users:read", "users.permissions:read", "users.roles:read", "teams.permissions:read", "roles:read", "settings:read", "org.users:read", "ldap.user:read", "server.stats:read"} {
		require.True(t, IsDeniedAction(a), a)
	}
	for _, a := range []string{"dashboards:read", "orgs:read", "serviceaccounts:read", "folders.permissions:read", "teams:read", "datasources:read"} {
		require.False(t, IsDeniedAction(a), a)
	}
}

func TestIsDeniedRoute(t *testing.T) {
	for _, c := range [][2]string{{"POST", "/api/user/password"}, {"GET", "/api/user/personal-access-tokens"}, {"GET", "/logout"},
		{"POST", "/api/serviceaccounts"}, {"DELETE", "/api/admin/users/:id"}, {"PUT", "/api/org/users/:userId"},
		{"PUT", "/api/user"}, {"PUT", "/api/user/preferences"},
		{"POST", "/api/teams"}, {"POST", "/api/teams/:id/members"}, {"POST", "/api/folders/:uid/permissions"}, {"POST", "/api/dashboards/uid/:uid/permissions"},
		{"POST", "/api/datasources/uid/:uid/permissions"}, {"POST", "/api/access-control/users/:id/roles"}, {"PUT", "/api/org"}, {"POST", "/api/orgs"},
		{"GET", "/api/users"}, {"GET", "/api/users/lookup"}, {"GET", "/api/admin/settings"}, {"GET", "/api/admin/stats"}, {"GET", "/api/orgs"},
		{"GET", "/api/org/users"}, {"GET", "/api/access-control/roles"}, {"GET", "/api/ldap/status"}} {
		require.True(t, IsDeniedRoute(c[0], c[1]), c[0]+" "+c[1])
	}
	for _, c := range [][2]string{{"GET", "/api/serviceaccounts/search"}, {"POST", "/api/dashboards/db"}, {"GET", "/api/user"}, {"GET", "/api/user/orgs"}, {"GET", "/api/org"}, {"GET", "/api/search"}, {"GET", "/api/user/preferences"}, {"GET", "/api/teams/search"}, {"GET", "/api/folders/:uid/permissions"}} {
		require.False(t, IsDeniedRoute(c[0], c[1]), c[0]+" "+c[1])
	}
}

func TestAdminReadsNeedExplicitScope(t *testing.T) {
	owner := map[string][]string{"users:read": {"users:*"}, "settings:read": {"settings:*"}, "dashboards:read": {"dashboards:*"}, "orgs:read": {"*"}}
	got := Effective(owner, Scopes{"*": nil}, false)
	require.NotContains(t, got, "users:read")
	require.NotContains(t, got, "settings:read")
	require.Contains(t, got, "dashboards:read")
	require.Contains(t, got, "orgs:read")
	// Wildcards still do not grant them once admin actions are allowed.
	require.NotContains(t, Effective(owner, Scopes{"*": nil}, true), "users:read")
	require.Contains(t, Effective(owner, Scopes{"users:read": nil}, true), "users:read")
	require.Error(t, ValidateRequested(owner, Scopes{"users:read": nil}, false))
	require.NoError(t, ValidateRequested(owner, Scopes{"users:read": nil}, true))
}

func TestEffectiveAdminActionsNeedExplicitScope(t *testing.T) {
	owner := map[string][]string{"dashboards:read": {"dashboards:*"}, "users.tokens:create": {"users:*"}}

	wild := Effective(owner, Scopes{"*": nil}, true)
	require.NotContains(t, wild, "users.tokens:create", "glob must not grant deny-listed actions even when allowed")
	require.Contains(t, wild, "dashboards:read")

	explicit := Effective(owner, Scopes{"users.tokens:create": nil}, true)
	require.Contains(t, explicit, "users.tokens:create")

}

func TestRouteAllowedMapsRouteToExplicitAction(t *testing.T) {
	has := func(actions ...string) func(string) bool {
		return func(a string) bool { return slices.Contains(actions, a) }
	}
	// settings:read lifts only the settings route, reads only.
	require.True(t, RouteAllowed("GET", "/api/admin/settings", true, has("settings:read")))
	require.False(t, RouteAllowed("PUT", "/api/admin/settings", true, has("settings:read")))
	for _, p := range []string{"/api/admin/stats", "/api/users", "/api/orgs", "/api/ldap/status", "/api/access-control/roles", "/api/admin/users"} {
		require.False(t, RouteAllowed("GET", p, true, has("settings:read")), p)
	}
	require.False(t, RouteAllowed("GET", "/api/orgs", true, has("orgs:read")), "non deny-listed actions never lift a route")
	require.False(t, RouteAllowed("POST", "/api/teams", true, has("settings:read")))
	require.True(t, RouteAllowed("POST", "/api/teams", true, has("teams:create")))
	// Without admin actions nothing is lifted; unmapped denied routes never are.
	require.False(t, RouteAllowed("GET", "/api/admin/settings", false, has("settings:read")))
	require.False(t, RouteAllowed("POST", "/api/user/email", true, has("settings:read", "users:write")))
	require.False(t, RouteAllowed("POST", "/api/folders/:uid/permissions", true, has("settings:read")))
	require.True(t, RouteAllowed("GET", "/api/dashboards/uid/x", true, has()))
}

func TestEffectiveDropsActionWhenScopeIntersectionIsEmpty(t *testing.T) {
	owner := map[string][]string{"datasources:query": {"datasources:uid:abc"}, "dashboards:read": {"dashboards:*"}}
	got := Effective(owner, Scopes{"datasources:query": {"datasources:uid:xyz"}, "dashboards:read": nil}, false)
	require.NotContains(t, got, "datasources:query")
	require.Contains(t, got, "dashboards:read")
}

func TestIsDeniedRoutePlaylistsAndShortURLs(t *testing.T) {
	for _, p := range []string{"/api/playlists", "/api/playlists/abc", "/api/short-urls", "/api/user/stars/dashboard/uid/x"} {
		require.True(t, IsDeniedRoute("POST", p), p)
	}
	require.False(t, IsDeniedRoute("GET", "/api/playlists"))
}
