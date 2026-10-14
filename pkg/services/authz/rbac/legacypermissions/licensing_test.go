package legacypermissions_test

import (
	"context"
	"fmt"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
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

func (dashboardGrantClient) List(_ context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	if req.Group == "dashboard.grafana.app" && req.Resource == "dashboards" && req.Verb == "get" {
		return &authzv1.ListResponse{Items: []string{"zanzana-dash"}}, nil
	}
	return &authzv1.ListResponse{}, nil
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
