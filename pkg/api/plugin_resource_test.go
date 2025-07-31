package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/caching"
	datasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	fakeSecrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	testdatasource "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestIntegrationCallResource(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	staticRootPath, err := filepath.Abs("../../public/")
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.StaticRootPath = staticRootPath
	cfg.Azure = &azsettings.AzureSettings{}
	settingsProvider := setting.ProvideService(cfg)

	coreRegistry := coreplugin.ProvideCoreRegistry(tracing.InitializeTracerForTest(), nil, &cloudwatch.Service{}, nil, nil, nil, nil,
		nil, nil, nil, nil, testdatasource.ProvideService(), nil, nil, nil, nil, nil, nil, nil, nil)

	testCtx := pluginsintegration.CreateIntegrationTestCtx(t, settingsProvider, coreRegistry)

	pcp := plugincontext.ProvideService(settingsProvider, localcache.ProvideService(), testCtx.PluginStore, &datasources.FakeCacheService{},
		&datasources.FakeDataSourceService{}, pluginSettings.ProvideService(db.InitTestDB(t), fakeSecrets.NewFakeSecretsService()), pluginconfig.NewFakePluginRequestConfigProvider())

	srv := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.ProvideService(cfg)
		hs.pluginContextProvider = pcp
		hs.QuotaService = quotatest.New(false, nil)
		hs.pluginStore = testCtx.PluginStore
		hs.pluginClient = testCtx.PluginClient
		hs.log = log.New("test")
	})

	t.Run("Test successful response is received for valid request", func(t *testing.T) {
		req := srv.NewPostRequest("/api/plugins/grafana-testdata-datasource/resources/test", strings.NewReader(`{"test": "true"}`))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{Action: pluginaccesscontrol.ActionAppAccess, Scope: pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
			}),
		}})
		resp, err := srv.SendJSON(req)
		require.NoError(t, err)

		b, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		body := make(map[string]any)
		err = json.Unmarshal(b, &body)
		require.NoError(t, err)

		require.Equal(t, "Hello world from test datasource!", body["message"])
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 200, resp.StatusCode)
	})

	t.Run("Test successful response is received for valid request with the colon character", func(t *testing.T) {
		req := srv.NewPostRequest("/api/plugins/grafana-testdata-datasource/resources/test-*,*:test-*/_mapping", strings.NewReader(`{"test": "true"}`))
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{Action: pluginaccesscontrol.ActionAppAccess, Scope: pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
			}),
		}})
		resp, err := srv.SendJSON(req)
		require.NoError(t, err)

		require.NoError(t, resp.Body.Close())
		require.Equal(t, 200, resp.StatusCode)
	})

	t.Run("CallResource plugin resource request is created correctly", func(t *testing.T) {
		type testdataCallResourceTestResponse struct {
			Message string `json:"message"`
			Request struct {
				URL  url.URL
				Body map[string]any `json:"body"`
			} `json:"request"`
		}

		for _, tc := range []struct {
			name string
			url  string
			exp  func(t *testing.T, resp testdataCallResourceTestResponse)
		}{
			{
				name: "Simple URL",
				url:  "/api/plugins/grafana-testdata-datasource/resources/test",
				exp: func(t *testing.T, resp testdataCallResourceTestResponse) {
					require.Equal(t, "Hello world from test datasource!", resp.Message)
					require.Equal(t, "/test", resp.Request.URL.Path)
					require.Equal(t, "true", resp.Request.Body["test"])
					require.Len(t, resp.Request.Body, 1)
					require.Empty(t, resp.Request.URL.RawQuery)
					require.Empty(t, resp.Request.URL.Query())
				},
			},
			{
				name: "URL with query params",
				url:  "/api/plugins/grafana-testdata-datasource/resources/test?test=true&a=b",
				exp: func(t *testing.T, resp testdataCallResourceTestResponse) {
					require.Equal(t, "Hello world from test datasource!", resp.Message)
					require.Equal(t, "/test", resp.Request.URL.Path)
					require.Equal(t, "test=true&a=b", resp.Request.URL.RawQuery)
					query := resp.Request.URL.Query()
					require.Equal(t, "true", query.Get("test"))
					require.Equal(t, "b", query.Get("a"))
					require.Len(t, query, 2)
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				req := srv.NewPostRequest(tc.url, strings.NewReader(`{"test": "true"}`))
				webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
					1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
						{Action: pluginaccesscontrol.ActionAppAccess, Scope: pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
					}),
				}})
				resp, err := srv.SendJSON(req)
				require.NoError(t, err)

				var body testdataCallResourceTestResponse
				require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

				tc.exp(t, body)

				require.NoError(t, resp.Body.Close())
				require.Equal(t, 200, resp.StatusCode)
			})
		}
	})

	pluginRegistry := fakes.NewFakePluginRegistry()
	require.NoError(t, pluginRegistry.Add(context.Background(), &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:      "grafana-testdata-datasource",
			Backend: true,
		},
	}))
	middlewares := pluginsintegration.CreateMiddlewares(cfg, &oauthtokentest.Service{}, tracing.InitializeTracerForTest(), &caching.OSSCachingService{}, featuremgmt.WithFeatures(), prometheus.DefaultRegisterer, pluginRegistry)
	pc, err := backend.HandlerFromMiddlewares(&fakes.FakePluginClient{
		CallResourceHandlerFunc: backend.CallResourceHandlerFunc(func(ctx context.Context,
			req *backend.CallResourceRequest, sender backend.CallResourceResponseSender,
		) error {
			return errors.New("something went wrong")
		}),
	}, middlewares...)
	require.NoError(t, err)

	srv = SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.ProvideService(cfg)
		hs.pluginContextProvider = pcp
		hs.QuotaService = quotatest.New(false, nil)
		hs.pluginStore = testCtx.PluginStore
		hs.pluginClient = pc
		hs.log = log.New("test")
	})

	t.Run("Test error is properly propagated to API response", func(t *testing.T) {
		req := srv.NewGetRequest("/api/plugins/grafana-testdata-datasource/resources/scenarios")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{Action: pluginaccesscontrol.ActionAppAccess, Scope: pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
			}),
		}})
		resp, err := srv.SendJSON(req)
		require.NoError(t, err)

		bodyBytes, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		var responseBody struct {
			Message string `json:"message"`
		}
		err = json.Unmarshal(bodyBytes, &responseBody)
		require.NoError(t, err)
		require.Equal(t, responseBody.Message, "Failed to call resource")
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 500, resp.StatusCode)
	})
}
