package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/updatechecker"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func Test_PluginsInstallAndUninstall(t *testing.T) {
	type tc struct {
		pluginAdminEnabled               bool
		pluginAdminExternalManageEnabled bool
		expectedHTTPStatus               int
		expectedHTTPBody                 string
	}
	tcs := []tc{
		{pluginAdminEnabled: true, pluginAdminExternalManageEnabled: true, expectedHTTPStatus: 404, expectedHTTPBody: "404 page not found\n"},
		{pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false, expectedHTTPStatus: 200, expectedHTTPBody: ""},
		{pluginAdminEnabled: false, pluginAdminExternalManageEnabled: true, expectedHTTPStatus: 404, expectedHTTPBody: "404 page not found\n"},
		{pluginAdminEnabled: false, pluginAdminExternalManageEnabled: false, expectedHTTPStatus: 404, expectedHTTPBody: "404 page not found\n"},
	}

	testName := func(action string, testCase tc) string {
		return fmt.Sprintf("%s request returns %d when adminEnabled: %t and externalEnabled: %t",
			action, testCase.expectedHTTPStatus, testCase.pluginAdminEnabled, testCase.pluginAdminExternalManageEnabled)
	}

	inst := NewFakePluginInstaller()
	for _, tc := range tcs {
		srv := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = &setting.Cfg{
				PluginAdminEnabled:               tc.pluginAdminEnabled,
				PluginAdminExternalManageEnabled: tc.pluginAdminExternalManageEnabled,
			}
			hs.pluginInstaller = inst
			hs.QuotaService = quotatest.New(false, nil)
		})

		t.Run(testName("Install", tc), func(t *testing.T) {
			req := srv.NewPostRequest("/api/plugins/test/install", strings.NewReader("{ \"version\": \"1.0.2\" }"))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleEditor, IsGrafanaAdmin: true})
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)

			body := new(strings.Builder)
			_, err = io.Copy(body, resp.Body)
			require.NoError(t, err)
			require.Equal(t, tc.expectedHTTPBody, body.String())
			require.NoError(t, resp.Body.Close())
			require.Equal(t, tc.expectedHTTPStatus, resp.StatusCode)

			if tc.expectedHTTPStatus == 200 {
				require.Equal(t, fakePlugin{pluginID: "test", version: "1.0.2"}, inst.plugins["test"])
			}
		})

		t.Run(testName("Uninstall", tc), func(t *testing.T) {
			req := srv.NewPostRequest("/api/plugins/test/uninstall", strings.NewReader("{}"))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleViewer, IsGrafanaAdmin: true})
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)

			body := new(strings.Builder)
			_, err = io.Copy(body, resp.Body)
			require.NoError(t, err)
			require.Equal(t, tc.expectedHTTPBody, body.String())
			require.NoError(t, resp.Body.Close())
			require.Equal(t, tc.expectedHTTPStatus, resp.StatusCode)

			if tc.expectedHTTPStatus == 200 {
				require.Empty(t, inst.plugins)
			}
		})
	}
}

func Test_PluginsInstallAndUninstall_AccessControl(t *testing.T) {
	canInstall := []ac.Permission{{Action: plugins.ActionInstall}}
	cannotInstall := []ac.Permission{{Action: "plugins:cannotinstall"}}

	type testCase struct {
		expectedCode                     int
		permissions                      []ac.Permission
		pluginAdminEnabled               bool
		pluginAdminExternalManageEnabled bool
	}
	tcs := []testCase{
		{expectedCode: http.StatusNotFound, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: true},
		{expectedCode: http.StatusNotFound, permissions: canInstall, pluginAdminEnabled: false, pluginAdminExternalManageEnabled: true},
		{expectedCode: http.StatusNotFound, permissions: canInstall, pluginAdminEnabled: false, pluginAdminExternalManageEnabled: false},
		{expectedCode: http.StatusForbidden, permissions: cannotInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false},
		{expectedCode: http.StatusOK, permissions: canInstall, pluginAdminEnabled: true, pluginAdminExternalManageEnabled: false},
	}

	testName := func(action string, tc testCase) string {
		return fmt.Sprintf("%s request returns %d when adminEnabled: %t, externalEnabled: %t, permissions: %q",
			action, tc.expectedCode, tc.pluginAdminEnabled, tc.pluginAdminExternalManageEnabled, tc.permissions)
	}

	for _, tc := range tcs {
		server := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = &setting.Cfg{
				RBACEnabled:                      true,
				PluginAdminEnabled:               tc.pluginAdminEnabled,
				PluginAdminExternalManageEnabled: tc.pluginAdminExternalManageEnabled}
			hs.orgService = &orgtest.FakeOrgService{ExpectedOrg: &org.Org{}}
			hs.pluginInstaller = NewFakePluginInstaller()
		})

		t.Run(testName("Install", tc), func(t *testing.T) {
			input := strings.NewReader(`{"version": "1.0.2"}`)
			req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/plugins/test/install", input), userWithPermissions(1, tc.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})

		t.Run(testName("Uninstall", tc), func(t *testing.T) {
			input := strings.NewReader("{ }")
			req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/plugins/test/uninstall", input), userWithPermissions(1, tc.permissions))
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
		service := &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{
				cdnPlugin.ToDTO(),
				nonCdnPlugin.ToDTO(),
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
				cfg, service, func(sc *scenarioContext) {
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
			cfg, service, func(sc *scenarioContext) {
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
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{p.ToDTO()},
		}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), service, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				require.Equal(t, expectedBody, sc.resp.Body.String())
			})
	})

	t.Run("Given a request for a relative path", func(t *testing.T) {
		p := createPluginDTO(plugins.JSONData{ID: pluginID}, plugins.External, pluginDir)
		service := &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{p},
		}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, tmpFileInParentDir.Name())
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), service, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 404, sc.resp.Code)
			})
	})

	t.Run("Given a request for an non-existing plugin file", func(t *testing.T) {
		p := createPluginDTO(plugins.JSONData{ID: pluginID}, plugins.External, pluginDir)
		service := &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{p},
		}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), service, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]interface{}
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, 404, sc.resp.Code)
				require.Equal(t, "Plugin file not found", respJson["message"])
			})
	})

	t.Run("Given a request for an non-existing plugin", func(t *testing.T) {
		service := &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{},
		}
		l := &logtest.Fake{}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), service, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]interface{}
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, 404, sc.resp.Code)
				require.Equal(t, "Plugin not found", respJson["message"])
				require.Zero(t, l.WarnLogs.Calls)
			})
	})

	t.Run("Given a request for a core plugin's file", func(t *testing.T) {
		service := &plugins.FakePluginStore{
			PluginList: []plugins.PluginDTO{
				{
					JSONData: plugins.JSONData{ID: pluginID},
					Class:    plugins.Core,
				},
			},
		}
		l := &logtest.Fake{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*",
			setting.NewCfg(), service, func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				require.Equal(t, expectedBody, sc.resp.Body.String())
				require.Zero(t, l.WarnLogs.Calls)
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

	for {
		if resp.Flushed {
			break
		}
	}

	require.Equal(t, resp.Header().Get("Content-Type"), "application/json")
	require.Equal(t, "sandbox", resp.Header().Get("Content-Security-Policy"))
}

func TestMakePluginResourceRequestSetCookieNotPresent(t *testing.T) {
	hs := HTTPServer{
		Cfg: setting.NewCfg(),
		log: log.New(),
		pluginClient: &fakePluginClient{
			headers: map[string][]string{"Set-Cookie": {"monster"}},
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	resp := httptest.NewRecorder()
	pCtx := backend.PluginContext{}
	err := hs.makePluginResourceRequest(resp, req, pCtx)
	require.NoError(t, err)

	for {
		if resp.Flushed {
			break
		}
	}
	require.Empty(t, resp.Header().Values("Set-Cookie"), "Set-Cookie header should not be present")
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

			for {
				if resp.Flushed {
					break
				}
			}
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

	for {
		if resp.Flushed {
			break
		}
	}

	require.Zero(t, resp.Header().Get("Content-Type"))
}

func TestPluginMarkdown(t *testing.T) {
	t.Run("Plugin not installed returns error", func(t *testing.T) {
		hs := HTTPServer{
			pluginStore: &plugins.FakePluginStore{
				PluginList: []plugins.PluginDTO{},
			},
		}

		pluginID := "test-datasource"
		md, err := hs.pluginMarkdown(context.Background(), pluginID, "test")
		require.ErrorAs(t, err, &plugins.NotFoundError{PluginID: pluginID})
		require.Equal(t, []byte{}, md)
	})

	t.Run("File fetch will be retried using different casing if error occurs", func(t *testing.T) {
		var requestedFiles []string

		origReadPluginFile := readPluginFile
		readPluginFile = func(p plugins.PluginDTO, name string) (fs.File, error) {
			requestedFiles = append(requestedFiles, name)
			return nil, errors.New("some error")
		}
		t.Cleanup(func() {
			readPluginFile = origReadPluginFile
		})

		p := createPluginDTO(plugins.JSONData{ID: "test-app"}, plugins.External, "")

		hs := HTTPServer{
			pluginStore: &plugins.FakePluginStore{PluginList: []plugins.PluginDTO{p}},
		}

		md, err := hs.pluginMarkdown(context.Background(), p.ID, "reAdMe")
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
			var requestedFiles []string

			origReadPluginFile := readPluginFile
			readPluginFile = func(p plugins.PluginDTO, name string) (fs.File, error) {
				requestedFiles = append(requestedFiles, name)
				return &FakeFile{data: bytes.NewReader(nil)}, nil
			}
			t.Cleanup(func() {
				readPluginFile = origReadPluginFile
			})

			p := createPluginDTO(plugins.JSONData{ID: "test-app"}, plugins.External, "")

			hs := HTTPServer{
				pluginStore: &plugins.FakePluginStore{PluginList: []plugins.PluginDTO{p}},
			}

			md, err := hs.pluginMarkdown(context.Background(), p.ID, tc.filePath)
			require.NoError(t, err)
			require.Equal(t, []byte{}, md)
			require.Equal(t, tc.expected, requestedFiles)
		}
	})

	t.Run("Non markdown file request returns an error", func(t *testing.T) {
		p := createPluginDTO(plugins.JSONData{ID: "test-app"}, plugins.External, "")
		hs := HTTPServer{
			pluginStore: &plugins.FakePluginStore{PluginList: []plugins.PluginDTO{p}},
		}

		md, err := hs.pluginMarkdown(context.Background(), p.ID, "test.json")
		require.ErrorIs(t, err, ErrUnexpectedFileExtension)
		require.Equal(t, []byte{}, md)
	})

	t.Run("Happy path", func(t *testing.T) {
		data := []byte{1, 2, 3}
		fakeFile := &FakeFile{data: bytes.NewReader(data)}

		origReadPluginFile := readPluginFile
		readPluginFile = func(p plugins.PluginDTO, name string) (fs.File, error) {
			return fakeFile, nil
		}
		t.Cleanup(func() {
			readPluginFile = origReadPluginFile
		})

		p := createPluginDTO(plugins.JSONData{ID: "test-app"}, plugins.External, "")
		hs := HTTPServer{
			pluginStore: &plugins.FakePluginStore{PluginList: []plugins.PluginDTO{p}},
		}

		md, err := hs.pluginMarkdown(context.Background(), p.ID, "someFile")
		require.NoError(t, err)
		require.Equal(t, data, md)
	})
}

func callGetPluginAsset(sc *scenarioContext) {
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func pluginAssetScenario(t *testing.T, desc string, url string, urlPattern string,
	cfg *setting.Cfg, pluginStore plugins.Store, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		cfg.IsFeatureToggleEnabled = func(_ string) bool { return false }
		hs := HTTPServer{
			Cfg:         cfg,
			pluginStore: pluginStore,
			log:         log.NewNopLogger(),
			pluginsCDNService: pluginscdn.ProvideService(&config.Cfg{
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
	bytes, err := json.Marshal(map[string]interface{}{
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
	p1 := &plugins.Plugin{
		PluginDir:     "/grafana/plugins/test-app/dist",
		Class:         plugins.External,
		DefaultNavURL: "/plugins/test-app/page/test",
		Signature:     plugins.SignatureUnsigned,
		Module:        "plugins/test-app/module",
		BaseURL:       "public/plugins/test-app",
		JSONData: plugins.JSONData{
			ID:   "test-app",
			Type: plugins.App,
			Name: "test-app",
			Info: plugins.Info{
				Version: "1.0.0",
			},
		},
	}
	p2 := &plugins.Plugin{
		PluginDir: "/grafana/public/app/plugins/datasource/mysql",
		Class:     plugins.Core,
		Pinned:    false,
		Signature: plugins.SignatureInternal,
		Module:    "app/plugins/datasource/mysql/module",
		BaseURL:   "public/app/plugins/datasource/mysql",
		JSONData: plugins.JSONData{
			ID:   "mysql",
			Type: plugins.DataSource,
			Name: "MySQL",
			Info: plugins.Info{
				Author:      plugins.InfoLink{Name: "Grafana Labs", URL: "https://grafana.com"},
				Description: "Data source for MySQL databases",
			},
		},
	}
	pluginStore := plugins.FakePluginStore{PluginList: []plugins.PluginDTO{p1.ToDTO(), p2.ToDTO()}}

	pluginSettings := pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
		"test-app": {ID: 0, OrgID: 1, PluginID: "test-app", PluginVersion: "1.0.0", Enabled: true},
		"mysql":    {ID: 0, OrgID: 1, PluginID: "mysql", PluginVersion: "", Enabled: true}},
	}

	type testCase struct {
		expectedCode    int
		role            org.RoleType
		isGrafanaAdmin  bool
		expectedPlugins []string
		filters         map[string]string
	}
	tcs := []testCase{
		{expectedCode: http.StatusOK, role: org.RoleViewer, expectedPlugins: []string{"mysql"}},
		{expectedCode: http.StatusOK, role: org.RoleViewer, isGrafanaAdmin: true, expectedPlugins: []string{"mysql", "test-app"}},
		{expectedCode: http.StatusOK, role: org.RoleAdmin, expectedPlugins: []string{"mysql", "test-app"}},
	}

	testName := func(tc testCase) string {
		return fmt.Sprintf("List request returns %d when role: %s, isGrafanaAdmin: %t, filters: %v",
			tc.expectedCode, tc.role, tc.isGrafanaAdmin, tc.filters)
	}

	testUser := func(role org.RoleType, isGrafanaAdmin bool) user.SignedInUser {
		return user.SignedInUser{
			UserID:         2,
			OrgID:          2,
			OrgName:        "TestOrg2",
			OrgRole:        role,
			Login:          "testUser",
			Name:           "testUser",
			Email:          "testUser@example.org",
			OrgCount:       1,
			IsGrafanaAdmin: isGrafanaAdmin,
			IsAnonymous:    false,
		}
	}

	for _, tc := range tcs {
		sc := setupHTTPServer(t, true)
		sc.hs.PluginSettings = &pluginSettings
		sc.hs.pluginStore = pluginStore
		sc.hs.pluginsUpdateChecker = updatechecker.ProvidePluginsService(sc.hs.Cfg, pluginStore)
		setInitCtxSignedInUser(sc.initCtx, testUser(tc.role, tc.isGrafanaAdmin))

		t.Run(testName(tc), func(t *testing.T) {
			response := callAPI(sc.server, http.MethodGet, "/api/plugins/", nil, t)
			require.Equal(t, tc.expectedCode, response.Code)

			var res dtos.PluginList
			err := json.NewDecoder(response.Body).Decode(&res)
			require.NoError(t, err)
			require.Len(t, res, len(tc.expectedPlugins))
			for _, plugin := range res {
				require.Contains(t, tc.expectedPlugins, plugin.Id)
			}
		})
	}
}

func createPluginDTO(jd plugins.JSONData, class plugins.Class, pluginDir string) plugins.PluginDTO {
	p := &plugins.Plugin{
		JSONData:  jd,
		Class:     class,
		PluginDir: pluginDir,
	}
	return p.ToDTO()
}

var _ fs.File = (*FakeFile)(nil)

type FakeFile struct {
	data io.Reader
}

func (f *FakeFile) Stat() (fs.FileInfo, error) {
	return nil, nil
}

func (f *FakeFile) Read(bytes []byte) (int, error) {
	return f.data.Read(bytes)
}

func (f *FakeFile) Close() error {
	return nil
}
