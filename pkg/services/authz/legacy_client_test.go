package authz

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

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
			clients, err := ProvideAuthZClients(
				cfg, tc.features, nil, tracing.InitializeTracerForTest(), prometheus.NewRegistry(),
				sql, service, actionSets, &unusedLegacyCheckZanzanaClient{},
				apiserver.ProvideEventualRestConfigProvider(), nil, loader, ac.NewScopeResolverRegistry(),
				acimpl.ProvideAccessControlTest(),
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
		})
	}
}
