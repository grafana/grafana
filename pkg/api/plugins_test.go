package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/auth"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/filestore"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/updatemanager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func Test_PluginsInstallAndUninstall(t *testing.T) {
	canInstall := []ac.Permission{{Action: pluginaccesscontrol.ActionInstall}}
	cannotInstall := []ac.Permission{{Action: "plugins:cannotinstall"}}

	pluginID := ""
	localOrg := int64(1)
	globalOrg := int64(ac.GlobalOrgID)

	type testCase struct {
		expectedCode                     int
		permissionOrg                    int64
		permissions                      []ac.Permission
		pluginAdminEnabled               bool
		pluginAdminExternalManageEnabled bool
		singleOrganization               bool
		preInstalledPlugin               bool
	}
	tcs := []testCase{
		{expectedCode: http.StatusOK, permissionOrg: globalOrg, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: true},
		{expectedCode: http.StatusNotFound, permissionOrg: globalOrg, permissions: canInstall, pluginAdminEnabled: false, pluginAdminExternalManageEnabled: true},
		{expectedCode: http.StatusNotFound, permissionOrg: globalOrg, permissions: canInstall, pluginAdminEnabled: false, pluginAdminExternalManageEnabled: false},
		{expectedCode: http.StatusForbidden, permissionOrg: globalOrg, permissions: cannotInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false},
		{expectedCode: http.StatusOK, permissionOrg: globalOrg, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false},
		{expectedCode: http.StatusForbidden, permissionOrg: localOrg, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false},
		{expectedCode: http.StatusForbidden, permissionOrg: localOrg, permissions: cannotInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false, singleOrganization: true},
		{expectedCode: http.StatusOK, permissionOrg: localOrg, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false, singleOrganization: true},
		{expectedCode: http.StatusConflict, permissionOrg: globalOrg, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false, preInstalledPlugin: true},
	}

	testName := func(action string, tc testCase) string {
		return fmt.Sprintf("%s request returns %d when adminEnabled: %t, externalEnabled: %t, permissions: %d: %s, single_org: %t",
			action, tc.expectedCode, tc.pluginAdminEnabled, tc.pluginAdminExternalManageEnabled, tc.permissionOrg, tc.permissions[0].Action, tc.singleOrganization)
	}

	for _, tc := range tcs {
		pluginID = "grafana-test-datasource"
		if tc.preInstalledPlugin {
			pluginID = "grafana-preinstalled-datasource"
		}
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Cfg.PluginAdminEnabled = tc.pluginAdminEnabled
			hs.Cfg.PluginAdminExternalManageEnabled = tc.pluginAdminExternalManageEnabled
			hs.Cfg.RBAC.SingleOrganization = tc.singleOrganization
			hs.Cfg.PreinstallPluginsAsync = []setting.InstallPlugin{{ID: "grafana-preinstalled-datasource", Version: "1.0.0"}}

			hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			hs.accesscontrolService = &actest.FakeService{}

			hs.pluginInstaller = NewFakePluginInstaller()
			hs.pluginFileStore = &fakes.FakePluginFileStore{}
			hs.pluginStore = pluginstore.NewFakePluginStore(pluginstore.Plugin{
				JSONData: plugins.JSONData{
					ID: pluginID,
				},
			})
			hs.managedPluginsService = managedplugins.NewNoop()
			hs.pluginPreinstall = pluginchecker.ProvidePreinstall(hs.Cfg)

			expectedIdentity := &authn.Identity{
				OrgID:       tc.permissionOrg,
				Permissions: map[int64]map[string][]string{},
				OrgRoles:    map[int64]org.RoleType{},
			}
			expectedIdentity.Permissions[tc.permissionOrg] = ac.GroupScopesByActionContext(context.Background(), tc.permissions)
			hs.authnService = &authntest.FakeService{
				ExpectedIdentity: expectedIdentity,
			}

			hs.log = log.NewNopLogger()
		})

		t.Run(testName("Install", tc), func(t *testing.T) {
			input := strings.NewReader(`{"version": "1.0.2"}`)
			endpoint := fmt.Sprintf("/api/plugins/%s/install", pluginID)
			req := webtest.RequestWithSignedInUser(server.NewPostRequest(endpoint, input), userWithPermissions(tc.permissionOrg, tc.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})

		t.Run(testName("Uninstall", tc), func(t *testing.T) {
			input := strings.NewReader("{ }")
			endpoint := fmt.Sprintf("/api/plugins/%s/uninstall", pluginID)
			req := webtest.RequestWithSignedInUser(server.NewPostRequest(endpoint, input), userWithPermissions(tc.permissionOrg, tc.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func Test_GetPluginAssetCDNRedirect(t *testing.T) {
	const cdnPluginID = "cdn-plugin"
	const nonCDNPluginID = "non-cdn-plugin"
	t.Run("Plugin CDN asset redirect", func(t *testing.T) {
		cdnPlugin := &plugins.Plugin{
			JSONData: plugins.JSONData{ID: cdnPluginID, Info: plugins.Info{Version: "1.0.0"}},
		}
		nonCdnPlugin := &plugins.Plugin{
			JSONData: plugins.JSONData{ID: nonCDNPluginID, Info: plugins.Info{Version: "2.0.0"}},
		}
		registry := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				cdnPluginID:    cdnPlugin,
				nonCDNPluginID: nonCdnPlugin,
			},
		}
		cfg := setting.NewCfg()
		cfg.PluginsCDNURLTemplate = "https://cdn.example.com"
		cfg.PluginSettings = map[string]map[string]string{
			cdnPluginID: {"cdn": "true"},
		}

		const cdnFolderBaseURL = "https://cdn.example.com/cdn-plugin/1.0.0/public/plugins/cdn-plugin"

		type tc struct {
			assetURL       string
			expRelativeURL string
		}
		for _, cas := range []tc{
			{"module.js", "module.js"},
			{"other/folder/file.js", "other/folder/file.js"},
			{"double////slashes/file.js", "double/slashes/file.js"},
		} {
			pluginAssetScenario(
				t,
				"When calling GET for a CDN plugin on",
				fmt.Sprintf("/public/plugins/%s/%s", cdnPluginID, cas.assetURL),
				"/public/plugins/:pluginId/*",
				cfg, registry, func(sc *scenarioContext) {
					// Get the prometheus metric (to test that the handler is instrumented correctly)
					counter := pluginsCDNFallbackRedirectRequests.With(prometheus.Labels{
						"plugin_id":      cdnPluginID,
						"plugin_version": "1.0.0",
					})

					// Encode the prometheus metric and get its value
					var m dto.Metric
					require.NoError(t, counter.Write(&m))
					before := m.Counter.GetValue()

					// Call handler
					callGetPluginAsset(sc)

					// Check redirect code + location
					require.Equal(t, http.StatusTemporaryRedirect, sc.resp.Code, "wrong status code")
					require.Equal(t, cdnFolderBaseURL+"/"+cas.expRelativeURL, sc.resp.Header().Get("Location"), "wrong location header")

					// Check metric
					require.NoError(t, counter.Write(&m))
					require.Equal(t, before+1, m.Counter.GetValue(), "prometheus metric not incremented")
				},
			)
		}
		pluginAssetScenario(
			t,
			"When calling GET for a non-CDN plugin on",
			fmt.Sprintf("/public/plugins/%s/%s", nonCDNPluginID, "module.js"),
			"/public/plugins/:pluginId/*",
			cfg, registry, func(sc *scenarioContext) {
				// Here the metric should not increment
				var m dto.Metric
				counter := pluginsCDNFallbackRedirectRequests.With(prometheus.Labels{
					"plugin_id":      nonCDNPluginID,
					"plugin_version": "2.0.0",
				})
				require.NoError(t, counter.Write(&m))
				require.Zero(t, m.Counter.GetValue())

				// Call handler
				callGetPluginAsset(sc)

				// 404 implies access to fs
				require.Equal(t, http.StatusNotFound, sc.resp.Code)
				require.Empty(t, sc.resp.Header().Get("Location"))

				// Ensure the metric did not change
				require.NoError(t, counter.Write(&m))
				require.Zero(t, m.Counter.GetValue())
			},
		)
	})
}

func Test_GetPluginAssets(t *testing.T) {
	pluginID := "test-plugin"
	pluginDir := "."
	tmpFile, err := os.CreateTemp(pluginDir, "")
	require.NoError(t, err)
	tmpFileInParentDir, err := os.CreateTemp("..", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err := os.RemoveAll(tmpFile.Name())
		require.NoError(t, err)
		err = os.RemoveAll(tmpFileInParentDir.Name())
		require.NoError(t, err)
	})
	expectedBody := "Plugin test"
	_, err = tmpFile.WriteString(expectedBody)
	require.NoError(t, err)

	requestedFile := filepath.Clean(tmpFile.Name())

	t.Run("Given a request for an existing plugin file", func(t *testing.T) {
		p := createPlugin(plugins.JSONData{ID: pluginID}, plugins.ClassExternal, plugins.NewLocalFS(filepath.Dir(requestedFile)))
		pluginRegistry := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p.ID: p,
			},
		}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), pluginRegistry, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				require.Equal(t, expectedBody, sc.resp.Body.String())
			})
	})

	t.Run("Given a request for a relative path", func(t *testing.T) {
		p := createPlugin(plugins.JSONData{ID: pluginID}, plugins.ClassExternal, plugins.NewFakeFS())
		pluginRegistry := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p.ID: p,
			},
		}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, tmpFileInParentDir.Name())
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), pluginRegistry, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 404, sc.resp.Code)
			})
	})

	t.Run("Given a request for an existing plugin file that is not listed as a signature covered file", func(t *testing.T) {
		p := createPlugin(plugins.JSONData{ID: pluginID}, plugins.ClassCore, plugins.NewLocalFS(filepath.Dir(requestedFile)))
		pluginRegistry := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p.ID: p,
			},
		}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), pluginRegistry, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
			})
	})

	t.Run("Given a request for an non-existing plugin file", func(t *testing.T) {
		p := createPlugin(plugins.JSONData{ID: pluginID}, plugins.ClassExternal, plugins.NewFakeFS())
		service := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p.ID: p,
			},
		}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), service, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]any
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, 404, sc.resp.Code)
				require.Equal(t, "Plugin file not found", respJson["message"])
			})
	})

	t.Run("Given a request for an non-existing plugin", func(t *testing.T) {
		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), fakes.NewFakePluginRegistry(), func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]any
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, 404, sc.resp.Code)
				require.Equal(t, "Plugin not found", respJson["message"])
			})
	})
}

func TestMakePluginResourceRequest(t *testing.T) {
	hs := HTTPServer{
		Cfg:          setting.NewCfg(),
		log:          log.New(),
		pluginClient: &fakePluginClient{},
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	resp := httptest.NewRecorder()
	pCtx := backend.PluginContext{}
	err := hs.makePluginResourceRequest(resp, req, pCtx)
	require.NoError(t, err)

	require.True(t, resp.Flushed, "response should be flushed after request is processed")

	res := resp.Result()
	require.NoError(t, res.Body.Close())
	require.Equal(t, http.StatusOK, res.StatusCode)
}

func TestMakePluginResourceRequestContentTypeUnique(t *testing.T) {
	// Ensures Content-Type is present only once, even if it's present with
	// a non-canonical key in the plugin response.

	// Test various upper/lower case combinations for content-type that may be returned by the plugin.
	for _, ctHeader := range []string{"content-type", "Content-Type", "CoNtEnT-TyPe"} {
		t.Run(ctHeader, func(t *testing.T) {
			hs := HTTPServer{
				Cfg: setting.NewCfg(),
				log: log.New(),
				pluginClient: &fakePluginClient{
					headers: map[string][]string{
						// This should be "overwritten" by the HTTP server
						ctHeader: {"application/json"},

						// Another header that should still be present
						"x-another": {"hello"},
					},
				},
			}
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			resp := httptest.NewRecorder()
			pCtx := backend.PluginContext{}
			err := hs.makePluginResourceRequest(resp, req, pCtx)
			require.NoError(t, err)

			require.True(t, resp.Flushed, "response should be flushed after request is processed")
			require.Len(t, resp.Header().Values("Content-Type"), 1, "should have 1 Content-Type header")
			require.Len(t, resp.Header().Values("x-another"), 1, "should have 1 X-Another header")
		})
	}
}

func TestMakePluginResourceRequestContentTypeEmpty(t *testing.T) {
	pluginClient := &fakePluginClient{
		statusCode: http.StatusNoContent,
	}
	hs := HTTPServer{
		Cfg:          setting.NewCfg(),
		log:          log.New(),
		pluginClient: pluginClient,
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	resp := httptest.NewRecorder()
	pCtx := backend.PluginContext{}
	err := hs.makePluginResourceRequest(resp, req, pCtx)
	require.NoError(t, err)

	require.True(t, resp.Flushed, "response should be flushed after request is processed")
	require.Zero(t, resp.Header().Get("Content-Type"))
}

func TestPluginMarkdown(t *testing.T) {
	t.Run("Plugin not installed returns error", func(t *testing.T) {
		pluginFileStore := &fakes.FakePluginFileStore{
			FileFunc: func(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error) {
				return nil, plugins.ErrPluginNotInstalled
			},
		}
		hs := HTTPServer{pluginFileStore: pluginFileStore}

		pluginID := "test-datasource"
		md, err := hs.pluginMarkdown(context.Background(), pluginID, "", "test")
		require.ErrorAs(t, err, &plugins.NotFoundError{PluginID: pluginID})
		require.Equal(t, []byte{}, md)
	})

	t.Run("File fetch will be retried using different casing if error occurs", func(t *testing.T) {
		var requestedFiles []string
		pluginFileStore := &fakes.FakePluginFileStore{
			FileFunc: func(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error) {
				requestedFiles = append(requestedFiles, filename)
				return nil, errors.New("some error")
			},
		}

		hs := HTTPServer{pluginFileStore: pluginFileStore}

		md, err := hs.pluginMarkdown(context.Background(), "", "", "reAdMe")
		require.NoError(t, err)
		require.Equal(t, []byte{}, md)
		require.Equal(t, []string{"README.md", "readme.md"}, requestedFiles)
	})

	t.Run("File fetch receive cleaned file paths", func(t *testing.T) {
		tcs := []struct {
			filePath string
			expected []string
		}{
			{
				filePath: "../../docs",
				expected: []string{"DOCS.md"},
			},
			{
				filePath: "/../../docs/../docs",
				expected: []string{"DOCS.md"},
			},
			{
				filePath: "readme.md/../../secrets",
				expected: []string{"SECRETS.md"},
			},
		}

		for _, tc := range tcs {
			data := []byte{123}
			var requestedFiles []string
			pluginFileStore := &fakes.FakePluginFileStore{
				FileFunc: func(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error) {
					requestedFiles = append(requestedFiles, filename)
					return &plugins.File{Content: data}, nil
				},
			}

			hs := HTTPServer{pluginFileStore: pluginFileStore}

			md, err := hs.pluginMarkdown(context.Background(), "test-datasource", "", tc.filePath)
			require.NoError(t, err)
			require.Equal(t, data, md)
			require.Equal(t, tc.expected, requestedFiles)
		}
	})

	t.Run("Non markdown file request returns an error", func(t *testing.T) {
		hs := HTTPServer{pluginFileStore: &fakes.FakePluginFileStore{}}

		md, err := hs.pluginMarkdown(context.Background(), "", "", "test.json")
		require.ErrorIs(t, err, ErrUnexpectedFileExtension)
		require.Equal(t, []byte{}, md)
	})

	t.Run("Happy path", func(t *testing.T) {
		data := []byte{1, 2, 3}

		pluginFileStore := &fakes.FakePluginFileStore{
			FileFunc: func(ctx context.Context, pluginID, pluginVersion, filename string) (*plugins.File, error) {
				return &plugins.File{Content: data}, nil
			},
		}

		hs := HTTPServer{pluginFileStore: pluginFileStore}

		md, err := hs.pluginMarkdown(context.Background(), "", "", "someFile")
		require.NoError(t, err)
		require.Equal(t, data, md)
	})
}

func callGetPluginAsset(sc *scenarioContext) {
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func pluginAssetScenario(t *testing.T, desc string, url string, urlPattern string,
	cfg *setting.Cfg, pluginRegistry registry.Service, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:             cfg,
			pluginStore:     pluginstore.New(pluginRegistry, &fakes.FakeLoader{}),
			pluginFileStore: filestore.ProvideService(pluginRegistry),
			log:             log.NewNopLogger(),
			pluginsCDNService: pluginscdn.ProvideService(&config.PluginManagementCfg{
				PluginsCDNURLTemplate: cfg.PluginsCDNURLTemplate,
				PluginSettings:        cfg.PluginSettings,
			}),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = func(c *contextmodel.ReqContext) {
			sc.context = c
			hs.getPluginAssets(c)
		}

		sc.m.Get(urlPattern, sc.defaultHandler)

		fn(sc)
	})
}

type fakePluginClient struct {
	plugins.Client

	req *backend.CallResourceRequest

	backend.QueryDataHandlerFunc

	statusCode int
	headers    map[string][]string
}

func (c *fakePluginClient) CallResource(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	c.req = req
	bytes, err := json.Marshal(map[string]any{
		"message": "hello",
	})
	if err != nil {
		return err
	}

	statusCode := http.StatusOK
	if c.statusCode != 0 {
		statusCode = c.statusCode
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  statusCode,
		Headers: c.headers,
		Body:    bytes,
	})
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.QueryDataHandlerFunc != nil {
		return c.QueryDataHandlerFunc.QueryData(ctx, req)
	}

	return backend.NewQueryDataResponse(), nil
}

func Test_PluginsList_AccessControl(t *testing.T) {
	p1 := createPlugin(plugins.JSONData{
		ID: "test-app", Type: "app", Name: "test-app",
		Info: plugins.Info{
			Version: "1.0.0",
		}}, plugins.ClassExternal, plugins.NewFakeFS())
	p2 := createPlugin(
		plugins.JSONData{ID: "mysql", Type: "datasource", Name: "MySQL",
			Info: plugins.Info{
				Author:      plugins.InfoLink{Name: "Grafana Labs", URL: "https://grafana.com"},
				Description: "Data source for MySQL databases",
			}}, plugins.ClassCore, plugins.NewFakeFS())

	pluginRegistry := &fakes.FakePluginRegistry{
		Store: map[string]*plugins.Plugin{
			p1.ID: p1,
			p2.ID: p2,
		},
	}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		"test-app": {ID: 0, OrgID: 1, PluginID: "test-app", PluginVersion: "1.0.0", Enabled: true},
		"mysql":    {ID: 0, OrgID: 1, PluginID: "mysql", PluginVersion: "", Enabled: true}},
	}

	type testCase struct {
		desc            string
		permissions     []ac.Permission
		expectedCode    int
		expectedPlugins []string
	}
	tcs := []testCase{
		{
			desc:            "should only be able to list core plugins",
			permissions:     []ac.Permission{},
			expectedCode:    http.StatusOK,
			expectedPlugins: []string{"mysql"},
		},
		{
			desc:            "should be able to list core plugins and plugins user has permission to",
			permissions:     []ac.Permission{{Action: pluginaccesscontrol.ActionWrite, Scope: "plugins:id:test-app"}},
			expectedCode:    http.StatusOK,
			expectedPlugins: []string{"mysql", "test-app"},
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.PluginSettings = &pluginSettings
				hs.pluginStore = pluginstore.New(pluginRegistry, &fakes.FakeLoader{})
				hs.pluginFileStore = filestore.ProvideService(pluginRegistry)
				hs.managedPluginsService = managedplugins.NewNoop()
				var err error
				hs.pluginsUpdateChecker, err = updatemanager.ProvidePluginsService(
					hs.Cfg,
					hs.pluginStore,
					nil, // plugins.Installer
					tracing.InitializeTracerForTest(),
					kvstore.NewFakeFeatureToggles(t, true),
					pluginchecker.ProvideService(hs.managedPluginsService, provisionedplugins.NewNoop(), &pluginchecker.FakePluginPreinstall{}),
				)
				require.NoError(t, err)
			})

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/plugins"), userWithPermissions(1, tc.permissions)))
			require.NoError(t, err)
			var result dtos.PluginList
			require.NoError(t, json.NewDecoder(res.Body).Decode(&result))
			require.Len(t, result, len(tc.expectedPlugins))
			for _, plugin := range result {
				require.Contains(t, tc.expectedPlugins, plugin.Id)
			}
			assert.Equal(t, tc.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func createPlugin(jd plugins.JSONData, class plugins.Class, files plugins.FS) *plugins.Plugin {
	return &plugins.Plugin{
		JSONData: jd,
		Class:    class,
		FS:       files,
	}
}

func TestHTTPServer_hasPluginRequestedPermissions(t *testing.T) {
	pluginReg := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "grafana-test-app",
			IAM: &auth.IAM{
				Permissions: []auth.Permission{{Action: ac.ActionUsersRead, Scope: ac.ScopeUsersAll}, {Action: ac.ActionUsersCreate}},
			},
		},
	}

	tests := []struct {
		name        string
		plugin      pluginstore.Plugin
		orgID       int64
		singleOrg   bool
		permissions map[int64]map[string][]string
		warnCount   int
	}{
		{
			name: "no warn if plugin has no registration",
			plugin: pluginstore.Plugin{
				JSONData: plugins.JSONData{
					ID: "grafana-test-app",
				},
			},
			warnCount: 0,
		},
		{
			name:   "warn if user does not have plugin permissions globally",
			plugin: pluginReg,
			orgID:  1,
			permissions: map[int64]map[string][]string{
				1: {ac.ActionUsersRead: {ac.ScopeUsersAll}, ac.ActionUsersCreate: {}},
			},
			warnCount: 1,
		},
		{
			name:   "no warn if user has plugin permissions globally",
			plugin: pluginReg,
			orgID:  0,
			permissions: map[int64]map[string][]string{
				0: {ac.ActionUsersRead: {ac.ScopeUsersAll}, ac.ActionUsersCreate: {}},
			},
			warnCount: 0,
		},
		{
			name:      "no warn if user has plugin permissions in single organization",
			plugin:    pluginReg,
			singleOrg: true,
			orgID:     1,
			permissions: map[int64]map[string][]string{
				1: {ac.ActionUsersRead: {ac.ScopeUsersAll}, ac.ActionUsersCreate: {}},
			},
			warnCount: 0,
		},
		{
			name:        "warn if user does not have all plugin permissions",
			plugin:      pluginReg,
			singleOrg:   true,
			orgID:       1,
			permissions: map[int64]map[string][]string{1: {ac.ActionUsersCreate: {}}},
			warnCount:   1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := &logtest.Fake{}
			hs := &HTTPServer{}
			httpReq, err := http.NewRequest(http.MethodGet, "", nil)
			require.NoError(t, err)

			hs.Cfg = setting.NewCfg()
			hs.Cfg.RBAC.SingleOrganization = tt.singleOrg
			hs.pluginStore = &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{tt.plugin},
			}
			hs.log = logger
			hs.accesscontrolService = actest.FakeService{}
			hs.AccessControl = acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

			expectedIdentity := &authn.Identity{
				OrgID:       tt.orgID,
				Permissions: tt.permissions,
			}
			hs.authnService = &authntest.FakeService{
				ExpectedIdentity: expectedIdentity,
			}

			c := &contextmodel.ReqContext{
				Context:      &web.Context{Req: httpReq},
				SignedInUser: &user.SignedInUser{OrgID: tt.orgID, Permissions: tt.permissions},
			}
			hs.hasPluginRequestedPermissions(c, "grafana-test-app")

			assert.Equal(t, tt.warnCount, logger.WarnLogs.Calls)
		})
	}
}

func Test_PluginsSettings(t *testing.T) {
	pID := "test-datasource"
	p1 := createPlugin(plugins.JSONData{
		ID: pID, Type: "datasource", Name: pID,
		Info: plugins.Info{
			Version: "1.0.0",
		}}, plugins.ClassExternal, plugins.NewFakeFS())
	pluginRegistry := &fakes.FakePluginRegistry{
		Store: map[string]*plugins.Plugin{
			p1.ID: p1,
		},
	}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		pID: {ID: 0, OrgID: 1, PluginID: pID, PluginVersion: "1.0.0"},
	}}

	type testCase struct {
		desc             string
		expectedCode     int
		errCode          plugins.ErrorCode
		expectedSettings dtos.PluginSetting
		expectedError    string
	}
	tcs := []testCase{
		{
			desc:         "should only be able to get plugin settings",
			expectedCode: http.StatusOK,
			expectedSettings: dtos.PluginSetting{
				Id:   pID,
				Name: pID,
				Type: "datasource",
				Info: plugins.Info{
					Version: "1.0.0",
				},
				SecureJsonFields: map[string]bool{},
				LoadingStrategy:  plugins.LoadingStrategyScript,
			},
		},
		{
			desc:          "should return a plugin error",
			expectedCode:  http.StatusInternalServerError,
			errCode:       plugins.ErrorCodeFailedBackendStart,
			expectedError: "Plugin failed to start",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.PluginSettings = &pluginSettings
				hs.pluginStore = pluginstore.New(pluginRegistry, &fakes.FakeLoader{})
				hs.pluginFileStore = filestore.ProvideService(pluginRegistry)
				errTracker := pluginerrs.ProvideErrorTracker()
				if tc.errCode != "" {
					errTracker.Record(context.Background(), &plugins.Error{
						PluginID:  pID,
						ErrorCode: tc.errCode,
					})
				}
				pCfg := &config.PluginManagementCfg{}
				pluginCDN := pluginscdn.ProvideService(pCfg)
				sig := signature.ProvideService(pCfg, statickey.New())
				hs.pluginAssets = pluginassets.ProvideService(pCfg, pluginCDN, sig, hs.pluginStore)
				hs.pluginErrorResolver = pluginerrs.ProvideStore(errTracker)
				var err error
				hs.pluginsUpdateChecker, err = updatemanager.ProvidePluginsService(
					hs.Cfg,
					hs.pluginStore,
					&fakes.FakePluginInstaller{},
					tracing.InitializeTracerForTest(),
					kvstore.NewFakeFeatureToggles(t, true),
					pluginchecker.ProvideService(hs.managedPluginsService, provisionedplugins.NewNoop(), &pluginchecker.FakePluginPreinstall{}),
				)
				require.NoError(t, err)
			})

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/plugins/"+pID+"/settings"), userWithPermissions(1, []ac.Permission{})))
			require.NoError(t, err)
			assert.Equal(t, tc.expectedCode, res.StatusCode)
			if tc.expectedCode == http.StatusOK {
				var result dtos.PluginSetting
				require.NoError(t, json.NewDecoder(res.Body).Decode(&result))
				require.NoError(t, res.Body.Close())
				assert.Equal(t, tc.expectedSettings, result)
			} else {
				var respJson map[string]any
				err := json.NewDecoder(res.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, tc.expectedError, respJson["message"])
			}
		})
	}
}

func Test_UpdatePluginSetting(t *testing.T) {
	pID := "test-app"
	p1 := createPlugin(plugins.JSONData{
		ID: pID, Type: "app", Name: pID,
		Info: plugins.Info{
			Version: "1.0.0",
		},
		AutoEnabled: true,
	}, plugins.ClassExternal, plugins.NewFakeFS(),
	)
	pluginRegistry := &fakes.FakePluginRegistry{
		Store: map[string]*plugins.Plugin{
			p1.ID: p1,
		},
	}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		pID: {ID: 0, OrgID: 1, PluginID: pID, PluginVersion: "1.0.0", Enabled: true},
	}}

	t.Run("should return an error when trying to disable an auto-enabled plugin", func(t *testing.T) {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.PluginSettings = &pluginSettings
			hs.pluginStore = pluginstore.New(pluginRegistry, &fakes.FakeLoader{})
			hs.pluginFileStore = filestore.ProvideService(pluginRegistry)
			hs.managedPluginsService = managedplugins.NewNoop()
			hs.log = log.NewNopLogger()
		})

		input := strings.NewReader(`{"enabled": false}`)
		endpoint := fmt.Sprintf("/api/plugins/%s/settings", pID)
		req := webtest.RequestWithSignedInUser(server.NewPostRequest(endpoint, input), userWithPermissions(1, []ac.Permission{{Action: pluginaccesscontrol.ActionWrite, Scope: "plugins:id:test-app"}}))
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusBadRequest, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}
