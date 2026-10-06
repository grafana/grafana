package legacypermissions_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLoaderReadsCurrentConfigAndLicense(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	cfg := loaderConfig(true)
	license := &enforcementLicense{}
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(),
		resourcepermissions.NewActionSetService(), localcache.New(0, 0),
		cfg, featuremgmt.WithFeatures(), license, nil)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
	a := ac.Permission{Action: "users:read", Scope: "users:*"}
	b := ac.Permission{Action: "users:create"}
	c := ac.Permission{Action: "users:delete", Scope: "users:*"}
	seedGrant(t, sql, "managed:one", 1, 7, a)
	seedGrant(t, sql, "custom:one", 1, 7, b)
	check := func(options ac.Options, want ...ac.Permission) {
		t.Helper()
		got, err := loader.GetUserPermissions(context.Background(), requester, options)
		require.NoError(t, err)
		require.ElementsMatch(t, append(want, ac.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}), got)
	}
	check(ac.Options{}, a)
	license.enabled = true
	require.False(t, license.HasValidLicense(), "the feature decision must not be replaced with overall license validity")
	check(ac.Options{ReloadCache: true}, a, b)
	seedGrant(t, sql, "managed:two", 1, 7, c)
	check(ac.Options{}, a, b)
	cfg.RBAC.PermissionCache = false
	check(ac.Options{}, a, b, c)
	license.enabled = false
	check(ac.Options{}, a, c)
}

func TestIntegrationLoaderReadsCurrentFeatureToggle(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	features := featuremgmt.NewMockFeatureToggles(t)
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(),
		resourcepermissions.NewActionSetService(), localcache.New(0, 0),
		loaderConfig(false), features, &licensing.OSSLicensingService{}, nil)
	permission := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one", Kind: "dashboards"}
	seedGrant(t, sql, "managed:one", 1, 7, permission)
	requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}
	for _, enabled := range []bool{false, true, false} {
		features.EXPECT().IsEnabledGlobally(featuremgmt.FlagExcludeRedundantManagedPermissions).Return(enabled).Once()
		got, err := loader.GetUserPermissions(context.Background(), requester, ac.Options{})
		require.NoError(t, err)
		want := []ac.Permission{{Action: "folders:read", Scope: "folders:uid:sharedwithme"}}
		if !enabled {
			want = append(want, ac.Permission{Action: permission.Action, Scope: permission.Scope})
		}
		require.ElementsMatch(t, want, got)
	}
}
