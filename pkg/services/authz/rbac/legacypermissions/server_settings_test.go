package legacypermissions_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationEnforcedLoaderUsesServerPolicy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cached := range []bool{false, true} {
		for _, filtered := range []bool{false, true} {
			t.Run(fmt.Sprintf("cache=%t/filter=%t", cached, filtered), func(t *testing.T) {
				sql := db.NewTestStore(t)
				managed := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one", Kind: "dashboards"}
				custom := ac.Permission{Action: "users:create"}
				seedGrant(t, sql, "managed:one", 1, 7, managed)
				seedGrant(t, sql, "custom:one", 1, 7, custom)
				cfg := loaderConfig(cached)
				features := featuremgmt.WithFeatures()
				if filtered {
					features = featuremgmt.WithFeatures(featuremgmt.FlagExcludeRedundantManagedPermissions)
				}
				actions := resourcepermissions.NewActionSetService()
				loader := legacypermissions.NewEnforcedLoader(sql, actions, localcache.New(0, 0), cfg, features, nil)
				embedded := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), actions,
					localcache.New(0, 0), cfg, features, &enforcementLicense{enabled: true}, nil)
				requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
				want := []ac.Permission{custom, {Action: "folders:read", Scope: "folders:uid:sharedwithme"}}
				if cached || !filtered {
					want = append(want, ac.Permission{Action: managed.Action, Scope: managed.Scope})
				}
				for _, options := range []ac.Options{{}, {}, {ReloadCache: true}} {
					got, err := loader.GetUserPermissions(t.Context(), requester, options)
					require.NoError(t, err)
					require.ElementsMatch(t, want, got)
					local, err := embedded.GetUserPermissions(t.Context(), requester, options)
					require.NoError(t, err)
					require.ElementsMatch(t, local, got)
				}
			})
		}
	}
}

func TestIntegrationEnforcedLoaderReadsCurrentProcessSettings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(true)
	features := featuremgmt.NewMockFeatureToggles(t)
	loader := legacypermissions.NewEnforcedLoader(sql, resourcepermissions.NewActionSetService(),
		localcache.New(0, 0), cfg, features, nil)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
	first := ac.Permission{Action: "users:read"}
	second := ac.Permission{Action: "users:create"}
	managed := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one", Kind: "dashboards"}
	seedGrant(t, sql, "custom:one", 1, 7, first)
	check := func(filtered bool, want ...ac.Permission) {
		t.Helper()
		features.EXPECT().IsEnabledGlobally(featuremgmt.FlagExcludeRedundantManagedPermissions).Return(filtered).Once()
		got, err := loader.GetUserPermissions(t.Context(), requester, ac.Options{})
		require.NoError(t, err)
		require.ElementsMatch(t, append(want, ac.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}), got)
	}
	check(false, first)
	seedGrant(t, sql, "custom:two", 1, 7, second)
	check(false, first)
	cfg.RBAC.PermissionCache = false
	check(false, first, second)
	seedGrant(t, sql, "managed:one", 1, 7, managed)
	check(true, first, second)
	check(false, first, second, ac.Permission{Action: managed.Action, Scope: managed.Scope})
}
