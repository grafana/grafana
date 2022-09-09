package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
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

	pm := &fakePluginManager{
		plugins: make(map[string]fakePlugin),
	}
	for _, tc := range tcs {
		srv := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = &setting.Cfg{
				PluginAdminEnabled:               tc.pluginAdminEnabled,
				PluginAdminExternalManageEnabled: tc.pluginAdminExternalManageEnabled,
			}
			hs.pluginManager = pm
			hs.QuotaService = quotatest.NewQuotaServiceFake()
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
				require.Equal(t, fakePlugin{pluginID: "test", version: "1.0.2"}, pm.plugins["test"])
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
				require.Empty(t, pm.plugins)
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

	pm := &fakePluginManager{
		plugins: make(map[string]fakePlugin),
	}

	for _, tc := range tcs {
		sc := setupHTTPServerWithCfg(t, true, &setting.Cfg{
			RBACEnabled:                      true,
			PluginAdminEnabled:               tc.pluginAdminEnabled,
			PluginAdminExternalManageEnabled: tc.pluginAdminExternalManageEnabled})
		setInitCtxSignedInViewer(sc.initCtx)
		setAccessControlPermissions(sc.acmock, tc.permissions, sc.initCtx.OrgID)
		sc.hs.pluginManager = pm

		t.Run(testName("Install", tc), func(t *testing.T) {
			input := strings.NewReader("{ \"version\": \"1.0.2\" }")
			response := callAPI(sc.server, http.MethodPost, "/api/plugins/test/install", input, t)
			assert.Equal(t, tc.expectedCode, response.Code)
		})

		t.Run(testName("Uninstall", tc), func(t *testing.T) {
			input := strings.NewReader("{ }")
			response := callAPI(sc.server, http.MethodPost, "/api/plugins/test/uninstall", input, t)
			assert.Equal(t, tc.expectedCode, response.Code)
		})
	}
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
		assert.NoError(t, err)
		err = os.RemoveAll(tmpFileInParentDir.Name())
		assert.NoError(t, err)
	})
	expectedBody := "Plugin test"
	_, err = tmpFile.WriteString(expectedBody)
	assert.NoError(t, err)

	requestedFile := filepath.Clean(tmpFile.Name())

	t.Run("Given a request for an existing plugin file that is listed as a signature covered file", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
			SignedFiles: map[string]struct{}{
				requestedFile: {},
			},
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logtest.Fake{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
				assert.Zero(t, l.WarnLogs.Calls)
			})
	})

	t.Run("Given a request for a relative path", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logtest.Fake{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, tmpFileInParentDir.Name())
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 404, sc.resp.Code)
			})
	})

	t.Run("Given a request for an existing plugin file that is not listed as a signature covered file", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logtest.Fake{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
				assert.Zero(t, l.WarnLogs.Calls)
			})
	})

	t.Run("Given a request for an non-existing plugin file", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logtest.Fake{}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]interface{}
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, "Plugin file not found", respJson["message"])
				assert.Zero(t, l.WarnLogs.Calls)
			})
	})

	t.Run("Given a request for an non-existing plugin", func(t *testing.T) {
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{},
		}
		l := &logtest.Fake{}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]interface{}
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, "Plugin not found", respJson["message"])
				assert.Zero(t, l.WarnLogs.Calls)
			})
	})

	t.Run("Given a request for a core plugin's file", func(t *testing.T) {
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: {
					Class: plugins.Core,
				},
			},
		}
		l := &logtest.Fake{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
				assert.Zero(t, l.WarnLogs.Calls)
			})
	})
}

func TestMakePluginResourceRequest(t *testing.T) {
	pluginClient := &fakePluginClient{}
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

	require.Equal(t, "sandbox", resp.Header().Get("Content-Security-Policy"))
}

func callGetPluginAsset(sc *scenarioContext) {
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func pluginAssetScenario(t *testing.T, desc string, url string, urlPattern string, pluginStore plugins.Store,
	logger log.Logger, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:         setting.NewCfg(),
			pluginStore: pluginStore,
			log:         logger,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = func(c *models.ReqContext) {
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
}

func (c *fakePluginClient) CallResource(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	c.req = req
	bytes, err := json.Marshal(map[string]interface{}{
		"message": "hello",
	})
	if err != nil {
		return err
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusOK,
		Headers: make(map[string][]string),
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
	pluginStore := fakePluginStore{plugins: map[string]plugins.PluginDTO{
		"test-app": {
			PluginDir:     "/grafana/plugins/test-app/dist",
			Class:         "external",
			DefaultNavURL: "/plugins/test-app/page/test",
			Pinned:        false,
			Signature:     "unsigned",
			Module:        "plugins/test-app/module",
			BaseURL:       "public/plugins/test-app",
			JSONData: plugins.JSONData{
				ID:   "test-app",
				Type: "app",
				Name: "test-app",
				Info: plugins.Info{
					Version: "1.0.0",
				},
			},
		},
		"mysql": {
			PluginDir: "/grafana/public/app/plugins/datasource/mysql",
			Class:     "core",
			Pinned:    false,
			Signature: "internal",
			Module:    "app/plugins/datasource/mysql/module",
			BaseURL:   "public/app/plugins/datasource/mysql",
			JSONData: plugins.JSONData{
				ID:   "mysql",
				Type: "datasource",
				Name: "MySQL",
				Info: plugins.Info{
					Author:      plugins.InfoLink{Name: "Grafana Labs", URL: "https://grafana.com"},
					Description: "Data source for MySQL databases",
				},
			},
		},
	}}
	pluginSettings := fakePluginSettings{plugins: map[string]*pluginsettings.DTO{
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
