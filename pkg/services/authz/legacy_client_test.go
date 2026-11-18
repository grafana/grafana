package authz

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/authlib/types"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type legacyCheckAccessControlService struct {
	recordingAccessControlService
	roles map[string]*ac.RoleDTO
}

func (s *legacyCheckAccessControlService) GetStaticRoles(context.Context) map[string]*ac.RoleDTO {
	return s.roles
}

// Any call to Zanzana would panic: legacy checks must stay on the RBAC client.
type unusedLegacyCheckZanzanaClient struct {
	zanzana.Client
}

func TestIntegrationProvideAuthZLegacyAccessClient(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, tc := range []struct {
		name     string
		features featuremgmt.FeatureToggles
	}{
		{
			name:     "RBAC",
			features: featuremgmt.WithFeatures(),
		},
		{
			name:     "Zanzana for modern checks",
			features: featuremgmt.WithFeatures(featuremgmt.FlagZanzana, featuremgmt.FlagZanzanaNoLegacyClient),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Anonymous.OrgRole = string(org.RoleViewer)
			sql := db.NewTestStore(t)
			grant := ac.Permission{Action: "contract:read", Scope: "contract:uid:allowed"}
			catalog := legacypermissions.NewRoleCatalog()
			catalog.Replace(map[string][]ac.Permission{string(org.RoleViewer): {grant}})
			actionSets := resourcepermissions.NewActionSetService()
			loader := legacypermissions.NewLoader(sql, catalog, actionSets, localcache.New(0, 0),
				cfg, tc.features, &licensing.OSSLicensingService{}, nil)
			service := &legacyCheckAccessControlService{
				roles: map[string]*ac.RoleDTO{string(org.RoleViewer): {Permissions: []ac.Permission{grant}}},
			}
			accessControl := acimpl.ProvideAccessControlTest()
			registry := prometheus.NewRegistry()
			clients, err := ProvideAuthZClients(
				cfg, tc.features, nil, tracing.InitializeTracerForTest(), registry,
				sql, service, actionSets, &unusedLegacyCheckZanzanaClient{},
				apiserver.ProvideEventualRestConfigProvider(), nil, loader, ac.NewScopeResolverRegistry(),
				accessControl,
			)
			require.NoError(t, err)
			client := ProvideAuthZLegacyAccessClient(clients)

			for _, check := range []struct {
				name             string
				evaluator        ac.Evaluator
				internalIdentity *LegacyInternalIdentity
				allowed          bool
			}{
				{
					name:      "matching grant",
					evaluator: ac.EvalPermission(grant.Action, grant.Scope),
					allowed:   true,
				},
				{
					name:      "ungranted scope",
					evaluator: ac.EvalPermission(grant.Action, "contract:uid:denied"),
				},
				{
					name: "any includes granted action",
					evaluator: ac.EvalAny(
						ac.EvalPermission("contract:write", grant.Scope),
						ac.EvalPermission(grant.Action, grant.Scope),
					),
					allowed: true,
				},
				{
					name: "all includes ungranted action",
					evaluator: ac.EvalAll(
						ac.EvalPermission(grant.Action, grant.Scope),
						ac.EvalPermission("contract:write", grant.Scope),
					),
				},
				{
					name:             "service profile uses embedded handler",
					evaluator:        ac.EvalPermission("dashboards:create"),
					internalIdentity: &LegacyInternalIdentity{Profile: LegacyInternalIdentityService},
					allowed:          true,
				},
				{
					name:             "provisioning profile uses embedded handler",
					evaluator:        ac.EvalPermission("dashboards:create"),
					internalIdentity: &LegacyInternalIdentity{Profile: LegacyInternalIdentityProvisioning},
					allowed:          true,
				},
				{
					name:             "internal profile denies ungranted action",
					evaluator:        ac.EvalPermission("users:delete"),
					internalIdentity: &LegacyInternalIdentity{Profile: LegacyInternalIdentityService},
				},
			} {
				t.Run(check.name, func(t *testing.T) {
					req := LegacyCheckRequest{
						Namespace:        "default",
						RequesterOrgID:   ptr.To[int64](1),
						Subject:          "anonymous:0",
						Evaluator:        check.evaluator,
						InternalIdentity: check.internalIdentity,
					}
					if check.internalIdentity != nil {
						req.Subject = ""
					}

					allowed, err := client.LegacyCheck(t.Context(), req)
					require.NoError(t, err)
					require.Equal(t, check.allowed, allowed)
				})
			}

			t.Run("shadow preserves local denial with embedded RBAC grant", func(t *testing.T) {
				featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
				requester := &identity.StaticRequester{
					Type:      types.TypeAnonymous,
					UserUID:   "0",
					OrgID:     1,
					Namespace: "default",
					Permissions: map[int64]map[string][]string{
						1: {grant.Action: {"contract:uid:different"}},
					},
				}

				allowed, err := accessControl.Evaluate(t.Context(), requester, ac.EvalPermission(grant.Action, grant.Scope))

				require.NoError(t, err)
				require.False(t, allowed)
				require.Eventually(t, func() bool {
					count, err := legacyCheckShadowComparisonCount(registry, "mismatch")
					return err == nil && count == 1
				}, 10*time.Second, time.Millisecond)
			})
		})
	}
}

func legacyCheckShadowComparisonCount(registry prometheus.Gatherer, result string) (float64, error) {
	families, err := registry.Gather()
	if err != nil {
		return 0, err
	}
	for _, family := range families {
		if family.GetName() != "grafana_accesscontrol_legacy_check_shadow_comparisons_total" {
			continue
		}
		for _, metric := range family.Metric {
			for _, label := range metric.Label {
				if label.GetName() == "result" && label.GetValue() == result {
					return metric.GetCounter().GetValue(), nil
				}
			}
		}
	}
	return 0, nil
}
