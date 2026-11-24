package router

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userk8s"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

type searchDirectoryConfig struct {
	apiserver.DirectRestConfigProvider
	handler http.Handler
}

func (d searchDirectoryConfig) GetDirectRestConfig(*contextmodel.ReqContext) *rest.Config {
	//nolint:bodyclose // The REST client owns the returned response body.
	return &rest.Config{Transport: &options.RoundTripperFunc{Fn: responsewriter.WrapHandler(d.handler)}}
}

type dashboardSearchClient struct{ client.NoopClient }

func (*dashboardSearchClient) List(context.Context, *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return &authzv1.ListResponse{Items: []string{"migrated-dashboard"}}, nil
}

func TestIntegrationPermissionSearchDirectIAM(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	const namespace = "stacks-12"
	headers := make(chan http.Header, 8)
	directory := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers <- r.Header.Clone()
		if r.URL.Path != "/apis/iam.grafana.app/v0alpha1/namespaces/"+namespace+"/searchUsers" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer caller-access" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"hits":[{"internalId":3,"name":"target"}],"totalHits":1}`)
	}))
	t.Cleanup(directory.Close)
	target, err := url.Parse(directory.URL)
	require.NoError(t, err)
	backend, err := newAggregateBackend("iam", metav1.APIGroup{Name: "iam.grafana.app"}, target, directory.Client().Transport)
	require.NoError(t, err)
	handler, err := backend.Load(t.Context())
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.StackID = "12"
	tracer := tracing.InitializeTracerForTest()
	users := userk8s.NewUserK8sService(log.New("test"), cfg, searchDirectoryConfig{handler: handler}, tracer)
	sql := db.NewTestStore(t)
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
	catalog := legacypermissions.NewRoleCatalog()
	actions := resourcepermissions.NewActionSetService()
	cache := localcache.New(0, 0)
	zanzana := &dashboardSearchClient{}
	loader := legacypermissions.ProvideLoader(sql, catalog, actions, cache, cfg, features, &licensing.OSSLicensingService{}, zanzana, nil, users)
	service, err := acimpl.ProvideService(cfg, sql, routing.NewRouteRegister(), cache, acimpl.ProvideAccessControl(features), users,
		actions, features, tracer, permreg.ProvidePermissionRegistry(), nil, zanzana, nil, iam.Features{}, legacypermissions.NewEmbeddedClient(loader, cfg), catalog, nil)
	require.NoError(t, err)

	for _, tc := range []struct{ name, access, id string }{
		{"both", "caller-access", "signed-id"},
		{"access-only", "caller-access", ""},
		{"id-only", "", "signed-id"},
		{"neither", "", ""},
	} {
		for _, enabled := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/flag=%t", tc.name, enabled), func(t *testing.T) {
				featuremgmt.WithFlagValues(t, map[string]any{featuremgmt.FlagAuthzLegacyUserPermissionsSearch: enabled})
				caller := &user.SignedInUser{
					UserID: 42, UserUID: "caller", OrgID: 1, Namespace: namespace, AccessToken: tc.access, IDToken: tc.id,
					Permissions: map[int64]map[string][]string{1: {ac.ActionUsersPermissionsRead: {"users:id:3"}}},
				}
				ctx := identity.WithRequester(t.Context(), caller)
				ctx = ctxkey.Set(ctx, &contextmodel.ReqContext{Context: &web.Context{}, SignedInUser: caller})
				got, err := service.SearchUsersPermissions(ctx, caller, ac.SearchOptions{Action: "dashboards:read"})
				require.NoError(t, err)
				require.Len(t, headers, 1)
				h := <-headers
				require.Equal(t, tc.id, h.Get("X-Grafana-Id"))
				if tc.access == "" {
					require.Empty(t, h.Values("Authorization"))
					require.Empty(t, h.Values("X-Access-Token"))
					require.Empty(t, got)
				} else {
					require.Equal(t, "Bearer "+tc.access, h.Get("Authorization"))
					require.Equal(t, "Bearer "+tc.access, h.Get("X-Access-Token"))
					require.Equal(t, map[int64][]ac.Permission{3: {{Action: "dashboards:read", Scope: "dashboards:uid:migrated-dashboard"}}}, got)
				}
			})
		}
	}
}
