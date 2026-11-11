package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type dashboardGrantClient struct{ client.NoopClient }

func (dashboardGrantClient) GetUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	return authlib.GetUserPermissionsResponse{Permissions: []authlib.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"}}}, nil
}

func TestIntegrationOSSLoaderAndLegacyRPCMergeZanzanaWithoutLicense(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			sql := db.NewTestStore(t)
			cfg := loaderConfig(cached)
			license := &licensing.OSSLicensingService{}
			require.False(t, license.HasValidLicense())
			require.False(t, license.FeatureEnabled("accesscontrol.enforcement"))
			loader := legacypermissions.ProvideLoader(sql, legacypermissions.NewRoleCatalog(),
				resourcepermissions.NewActionSetService(), localcache.New(0, 0), cfg,
				featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions), license, &dashboardGrantClient{}, nil)
			legacyClient := legacypermissions.ProvideClient(loader, cfg)
			requester := &user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
			want := []ac.Permission{
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
				{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"},
			}
			for _, options := range []ac.Options{{}, {}, {ReloadCache: true}, {SkipZanzanaCache: true}, {ReloadCache: true, SkipZanzanaCache: true}} {
				// Exercise both the existing RPC's evaluator and the legacy transport.
				got, err := loader.GetLocalUserPermissions(t.Context(), requester, options)
				require.NoError(t, err)
				require.ElementsMatch(t, want, got)
				got, err = acimpl.GetLegacyUserPermissions(t.Context(), legacyClient, requester, options, cfg)
				require.NoError(t, err)
				require.ElementsMatch(t, want, got)
			}
		})
	}
}
