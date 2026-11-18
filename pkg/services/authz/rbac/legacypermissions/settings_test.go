package legacypermissions_test

import (
	"context"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/open-feature/go-sdk/openfeature"
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

func TestIntegrationGlobalLoaderUsesOpenFeature(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	actions := resourcepermissions.NewActionSetService()
	actions.StoreActionSet("dashboards:view", []string{"dashboards:read"})
	loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(),
		actions, localcache.New(0, 0), loaderConfig(false),
		featuremgmt.NewMockFeatureToggles(t), &licensing.OSSLicensingService{}, nil)
	seedGrant(t, sql, "managed:direct", ac.GlobalOrgID, 7, ac.Permission{
		Action: "dashboards:read", Scope: "dashboards:uid:direct", Kind: "dashboards",
	})
	seedGrant(t, sql, "managed:action-set", ac.GlobalOrgID, 7, ac.Permission{
		Action: "dashboards:view", Scope: "dashboards:uid:action-set", Kind: "dashboards",
	})
	requester := &user.SignedInUser{UserID: 7, OrgID: ac.GlobalOrgID, OrgRole: org.RoleNone}

	for _, tc := range []struct {
		name     string
		target   string
		provider openfeature.FeatureProvider
		want     map[string][]string
	}{
		{
			name:     "disabled for request preserves direct grants",
			target:   "disabled",
			provider: globalPermissionsFeatureProvider{},
			want:     map[string][]string{"dashboards:read": {"dashboards:uid:direct", "dashboards:uid:action-set"}},
		},
		{
			name:     "enabled for request keeps only action-set grants",
			target:   "enabled",
			provider: globalPermissionsFeatureProvider{},
			want:     map[string][]string{"dashboards:read": {"dashboards:uid:action-set"}},
		},
		{
			name:     "missing provider defaults to disabled",
			target:   "enabled",
			provider: openfeature.NoopProvider{},
			want:     map[string][]string{"dashboards:read": {"dashboards:uid:direct", "dashboards:uid:action-set"}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, openfeature.SetProviderAndWait(tc.provider))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
			ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext(tc.target, nil))

			got, err := loader.GetGlobalUserPermissions(ctx, requester, []string{"dashboards:read"})

			require.NoError(t, err)
			require.Empty(t, cmp.Diff(tc.want, got, cmpopts.SortSlices(func(a, b string) bool { return a < b })))
		})
	}
}

type globalPermissionsFeatureProvider struct{ openfeature.NoopProvider }

func (globalPermissionsFeatureProvider) BooleanEvaluation(
	_ context.Context,
	flag string,
	fallback bool,
	ctx openfeature.FlattenedContext,
) openfeature.BoolResolutionDetail {
	if flag != featuremgmt.FlagExcludeRedundantManagedPermissions {
		return openfeature.BoolResolutionDetail{Value: fallback}
	}

	return openfeature.BoolResolutionDetail{Value: ctx[openfeature.TargetingKey] == "enabled"}
}
