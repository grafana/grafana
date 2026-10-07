package acimpl

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func newContractLoader(s *Service, cache *localcache.CacheService) *legacypermissions.Loader {
	return legacypermissions.NewLoader(s.sql, s.RoleCatalog(), s.actionResolver, cache,
		s.cfg, s.features, &licensing.OSSLicensingService{}, nil,
	)
}

func rawPermissions(permissions []ac.Permission) []ac.Permission {
	out := make([]ac.Permission, len(permissions))
	for i, p := range permissions {
		out[i] = ac.Permission{Action: p.Action, Scope: p.Scope}
	}
	return out
}

func TestIntegrationLegacyLoaderParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cached
			seedContractSources(t, s.sql)
			addContractUserGrant(t, s.sql, "managed:global", 0, 7, ac.Permission{Action: "users:read", Scope: "users:*"})
			addContractUserGrant(t, s.sql, "custom:excluded", 1, 7, ac.Permission{Action: "users:create"})
			loader := newContractLoader(s, localcache.New(0, 0))
			for _, requester := range []user.SignedInUser{
				{UserID: 7, UserUID: "8", OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}},
				{UserID: 7, OrgID: 1, OrgRole: org.RoleNone},
				{UserID: 8, OrgID: 1, OrgRole: org.RoleNone, TeamIDs: []int64{10}},
				{UserID: 7, OrgID: 1, OrgRole: org.RoleNone, IsServiceAccount: true},
				{IsAnonymous: true, OrgID: 1, OrgRole: org.RoleViewer},
				{AuthenticatedBy: "render", OrgID: 1, OrgRole: org.RoleViewer},
				{UserID: 7, AuthenticatedBy: "render", OrgID: 1, OrgRole: org.RoleNone},
				{ApiKeyID: 7, OrgID: 1, OrgRole: org.RoleViewer},
				{OrgID: 1, OrgRole: org.RoleNone},
				{UserID: 7, OrgID: 0, OrgRole: org.RoleViewer},
				{UserID: 7, OrgID: 0, OrgRole: org.RoleNone, IsGrafanaAdmin: true},
			} {
				for _, options := range []ac.Options{{}, {}, {SkipZanzanaCache: true}, {ReloadCache: true}, {ReloadCache: true, SkipZanzanaCache: true}} {
					want, err := s.GetUserPermissions(context.Background(), &requester, options)
					require.NoError(t, err)
					// A call back into any Access Control store method would now panic.
					old := s.store
					s.store = nil
					got, err := loader.GetUserPermissions(context.Background(), &requester, options)
					s.store = old
					require.NoError(t, err)
					require.ElementsMatch(t, rawPermissions(want), rawPermissions(got))
				}
			}
		})
	}
}

func TestIntegrationLegacyLoaderRegistrationAndInvalidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	s := setupTestEnv(t, false)
	s.cfg.RBAC.PermissionCache = true
	seedContractSources(t, s.sql)
	// Mutation/registration and loader share the same cache, but the loader
	// never reads through the Access Control service.
	loader := newContractLoader(s, s.cache)
	ctx := context.Background()
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}} //nolint:staticcheck // Legacy RBAC memberships require numeric IDs, not contextual team UIDs.
	baseline := SharedWithMeFolderPermission
	a := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:shared"}
	b := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:changed"}
	check := func(options ac.Options, want ...ac.Permission) {
		t.Helper()
		got, err := loader.GetUserPermissions(ctx, requester, options)
		require.NoError(t, err)
		require.ElementsMatch(t, want, rawPermissions(got))
	}
	check(ac.Options{}, baseline, a, a, a)
	require.NoError(t, s.sql.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", b.Scope, a.Scope)
		return err
	}))
	check(ac.Options{SkipZanzanaCache: true}, baseline, a, a, a)
	s.ClearUserPermissionCache(requester)
	check(ac.Options{}, baseline, b, a, a)
	check(ac.Options{ReloadCache: true}, baseline, b, b, b)
	require.NoError(t, s.RegisterFixedRoles(ctx))
	plugin := ac.Permission{Action: "contract-app:read", Scope: "contract-app:*"}
	require.NoError(t, s.DeclarePluginRoles(ctx, "contract-app", "Contract", []plugins.RoleRegistration{{
		Role:   plugins.Role{Name: "Reader", Permissions: []plugins.Permission{{Action: plugin.Action, Scope: plugin.Scope}}},
		Grants: []string{"Viewer"},
	}}))
	check(ac.Options{}, baseline, b, b, b, plugin)
}
