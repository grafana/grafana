package authz

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationEmbeddedPermissionRPCsShareLoader(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	cfg := setting.NewCfg()
	cfg.Anonymous.OrgRole = "Viewer"
	sql := db.NewTestStore(t)
	features := featuremgmt.WithFeatures()
	catalog := legacypermissions.NewRoleCatalog()
	grant := ac.Permission{Action: "contract:read", Scope: "contract:*"}
	catalog.Replace(map[string][]ac.Permission{"Viewer": {grant, grant}})
	loader := legacypermissions.NewLoader(sql, catalog, resourcepermissions.NewActionSetService(), localcache.New(0, 0),
		cfg, features, &licensing.OSSLicensingService{}, nil)
	// This service deliberately has no local evaluator. Enumeration must no longer
	// call back into Access Control, even when using the pre-existing AuthZ client.
	service := &recordingAccessControlService{}
	clients, err := ProvideAuthZClients(cfg, features, nil, tracing.InitializeTracerForTest(), prometheus.NewRegistry(), sql,
		service, nil, apiserver.ProvideEventualRestConfigProvider(), nil, loader)
	require.NoError(t, err)
	previousClient := newUserPermissionsClient(ProvideAuthZUserPermissionsClient(clients), false)
	legacyClient := legacypermissions.NewEmbeddedClient(loader, cfg)
	requester := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer, Namespace: "default", IsAnonymous: true}
	baseline := ac.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
	for _, current := range []ac.Permission{grant, {Action: "contract:create"}} {
		catalog.Replace(map[string][]ac.Permission{"Viewer": {current, current}})
		previous, err := previousClient.GetUserPermissions(t.Context(), requester, ac.Options{})
		require.NoError(t, err)
		require.ElementsMatch(t, []ac.Permission{current, baseline}, previous)
		compatibility, err := ac.GetLegacyUserPermissions(t.Context(), legacyClient, requester, ac.Options{}, cfg)
		require.NoError(t, err)
		require.ElementsMatch(t, []ac.Permission{current, current, baseline}, compatibility)
	}
}
