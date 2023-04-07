package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	pluginClient "github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	datasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/config"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	fakeSecrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/tsdb/testdatasource"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestCallResource(t *testing.T) {
	staticRootPath, err := filepath.Abs("../../public/")
	require.NoError(t, err)

	cfg := setting.NewCfg()

	cfg.StaticRootPath = staticRootPath
	cfg.IsFeatureToggleEnabled = func(_ string) bool {
		return false
	}
	cfg.Azure = &azsettings.AzureSettings{}

	coreRegistry := coreplugin.ProvideCoreRegistry(nil, &cloudwatch.CloudWatchService{}, nil, nil, nil, nil,
		nil, nil, nil, nil, testdatasource.ProvideService(cfg, featuremgmt.WithFeatures()), nil, nil, nil, nil, nil, nil)
	pCfg, err := config.ProvideConfig(setting.ProvideProvider(cfg), cfg)
	require.NoError(t, err)
	reg := registry.ProvideService()
	l := loader.ProvideService(pCfg, fakes.NewFakeLicensingService(), signature.NewUnsignedAuthorizer(pCfg),
		reg, provider.ProvideService(coreRegistry), finder.NewLocalFinder(), fakes.NewFakeRoleRegistry(),
		assetpath.ProvideService(pluginscdn.ProvideService(pCfg)))
	srcs := sources.ProvideService(cfg, pCfg)
	ps, err := store.ProvideService(reg, srcs, l)
	require.NoError(t, err)

	pcp := plugincontext.ProvideService(localcache.ProvideService(), ps, &datasources.FakeDataSourceService{},
		pluginSettings.ProvideService(db.InitTestDB(t), fakeSecrets.NewFakeSecretsService()), plugincontext.ProvideKeyService())

	srv := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.pluginContextProvider = pcp
		hs.QuotaService = quotatest.New(false, nil)
		hs.pluginStore = ps
		hs.pluginClient = pluginClient.ProvideService(reg, pCfg)
	})

	t.Run("Test successful response is received for valid request", func(t *testing.T) {
		req := srv.NewPostRequest("/api/plugins/testdata/resources/test", strings.NewReader("{ \"test\": true }"))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{
				{Action: pluginaccesscontrol.ActionAppAccess, Scope: pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
			}),
		}})
		resp, err := srv.SendJSON(req)
		require.NoError(t, err)

		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		var body = make(map[string]interface{})
		err = json.Unmarshal(b, &body)
		require.NoError(t, err)

		require.Equal(t, "Hello world from test datasource!", body["message"])
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 200, resp.StatusCode)
	})

	pc, err := pluginClient.NewDecorator(&fakes.FakePluginClient{
		CallResourceHandlerFunc: backend.CallResourceHandlerFunc(func(ctx context.Context,
			req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			return errors.New("something went wrong")
		}),
	}, pluginsintegration.CreateMiddlewares(cfg, &oauthtokentest.Service{}, tracing.InitializeTracerForTest())...)
	require.NoError(t, err)

	srv = SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.pluginContextProvider = pcp
		hs.QuotaService = quotatest.New(false, nil)
		hs.pluginStore = ps
		hs.pluginClient = pc
	})

	t.Run("Test error is properly propagated to API response", func(t *testing.T) {
		req := srv.NewGetRequest("/api/plugins/testdata/resources/scenarios")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{
				{Action: pluginaccesscontrol.ActionAppAccess, Scope: pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
			}),
		}})
		resp, err := srv.SendJSON(req)
		require.NoError(t, err)

		body := new(strings.Builder)
		_, err = io.Copy(body, resp.Body)
		require.NoError(t, err)

		expectedBody := `{ "error": "something went wrong", "message": "Failed to call resource", "traceID": "" }`
		require.JSONEq(t, expectedBody, body.String())
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 500, resp.StatusCode)
	})
}
