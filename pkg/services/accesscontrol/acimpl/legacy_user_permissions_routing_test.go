package acimpl

import (
	"context"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLegacyPermissionRouting(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, enabled := range []bool{false, true} {
		name := "disabled"
		if enabled {
			name = "enabled"
		}
		t.Run(name, func(t *testing.T) {
			require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAuthzLegacyUserPermissions: {State: memprovider.Enabled, Variants: map[string]any{"value": enabled}, DefaultVariant: "value"},
			})))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
			s := setupTestEnv(t, false)
			seedContractSources(t, s.sql)
			s.legacyClient = legacypermissions.NewEmbeddedClient(legacypermissions.NewLoader(s.sql, s.RoleCatalog(), s.actionResolver, s.cache, s.cfg, s.features, &licensing.OSSLicensingService{}, nil), s.cfg)
			if enabled {
				s.store = nil
			} else {
				s.legacyClient = nil
			}
			permissions, err := s.GetUserPermissions(context.Background(), &user.SignedInUser{UserID: 7, UserUID: "8", OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}}, ac.Options{}) //nolint:staticcheck // Verify legacy numeric RBAC membership survives transport.
			require.NoError(t, err)
			require.ElementsMatch(t, []ac.Permission{
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
				{Action: "dashboards:read", Scope: "dashboards:uid:shared"},
				{Action: "dashboards:read", Scope: "dashboards:uid:shared"},
				{Action: "dashboards:read", Scope: "dashboards:uid:shared"},
			}, permissions)
			if enabled {
				// With the old store unavailable, a missing client must fail rather
				// than silently falling back to the legacy implementation.
				s.legacyClient = nil
				permissions, err = s.GetUserPermissions(context.Background(), &user.SignedInUser{UserID: 7, OrgID: 1}, ac.Options{})
				require.ErrorContains(t, err, "embedded legacy AuthZ client is not configured")
				require.Empty(t, permissions)
			}
		})
	}
}
