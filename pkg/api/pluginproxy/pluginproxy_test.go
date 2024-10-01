package pluginproxy

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestPluginProxy(t *testing.T) {
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())

	t.Run("When getting proxy headers", func(t *testing.T) {
		route := &plugins.Route{
			Headers: []plugins.Header{
				{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
			},
		}

		key, err := secretsService.Encrypt(context.Background(), []byte("123"), secrets.WithoutScope())
		require.NoError(t, err)

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{
				SecureJSONData: map[string][]byte{
					"key": key,
				},
			},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login: "test_user",
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)

		assert.Equal(t, "my secret 123", req.Header.Get("x-header"))
	})

	t.Run("When SendUserHeader config is enabled", func(t *testing.T) {
		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login:        "test_user",
					FallbackType: claims.TypeUser,
					UserID:       1,
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			nil,
		)

		// Get will return empty string even if header is not set
		assert.Equal(t, "test_user", req.Header.Get("X-Grafana-User"))
	})

	t.Run("When SendUserHeader config is disabled", func(t *testing.T) {
		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login: "test_user",
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: false},
			nil,
		)
		// Get will return empty string even if header is not set
		assert.Equal(t, "", req.Header.Get("X-Grafana-User"))
	})

	t.Run("When SendUserHeader config is enabled but user is anonymous", func(t *testing.T) {
		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{IsAnonymous: true},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			nil,
		)

		// Get will return empty string even if header is not set
		assert.Equal(t, "", req.Header.Get("X-Grafana-User"))
	})

	t.Run("When getting templated url", func(t *testing.T) {
		route := &plugins.Route{
			URL:    "{{.JsonData.dynamicUrl}}",
			Method: "GET",
		}

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{
				JSONData: map[string]any{
					"dynamicUrl": "https://dynamic.grafana.com",
				},
			},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login: "test_user",
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)
		assert.Equal(t, "https://dynamic.grafana.com", req.URL.String())
		assert.Equal(t, "{{.JsonData.dynamicUrl}}", route.URL)
	})

	t.Run("When getting complex templated url", func(t *testing.T) {
		route := &plugins.Route{
			URL:    "{{if .JsonData.apiHost}}{{.JsonData.apiHost}}{{else}}https://example.com{{end}}",
			Method: "GET",
		}

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login: "test_user",
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)
		assert.Equal(t, "https://example.com", req.URL.String())
	})

	t.Run("When getting templated body", func(t *testing.T) {
		route := &plugins.Route{
			Path: "api/body",
			URL:  "http://www.test.com",
			Body: []byte(`{ "url": "{{.JsonData.dynamicUrl}}", "secret": "{{.SecureJsonData.key}}"	}`),
		}

		encryptedJsonData, err := secretsService.EncryptJsonData(
			context.Background(),
			map[string]string{"key": "123"},
			secrets.WithoutScope(),
		)
		require.NoError(t, err)

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&pluginsettings.DTO{
				JSONData:       map[string]any{"dynamicUrl": "https://dynamic.grafana.com"},
				SecureJSONData: encryptedJsonData,
			},
			secretsService,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login: "test_user",
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)
		content, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.Equal(t, `{ "url": "https://dynamic.grafana.com", "secret": "123"	}`, string(content))
	})

	t.Run("When proxying a request should set expected response headers", func(t *testing.T) {
		requestHandled := false
		backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("I am the backend"))
			requestHandled = true
		}))
		t.Cleanup(backendServer.Close)

		responseWriter := web.NewResponseWriter("GET", httptest.NewRecorder())

		routes := []*plugins.Route{
			{
				Path: "/",
				URL:  backendServer.URL,
			},
		}

		ctx := &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{},
			Context: &web.Context{
				Req:  httptest.NewRequest("GET", "/", nil),
				Resp: responseWriter,
			},
		}
		ps := &pluginsettings.DTO{
			SecureJSONData: map[string][]byte{},
		}
		cfg := &setting.Cfg{}
		proxy, err := NewPluginProxy(ps, routes, ctx, "", cfg, secretsService, tracing.InitializeTracerForTest(), &http.Transport{}, acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()), featuremgmt.WithFeatures())
		require.NoError(t, err)
		proxy.HandleRequest()

		for {
			if requestHandled {
				break
			}
		}

		require.Equal(t, "sandbox", ctx.Resp.Header().Get("Content-Security-Policy"))
	})
}

func TestPluginProxyRoutes(t *testing.T) {
	routes := []*plugins.Route{
		{
			Path:   "",
			Method: "GET",
			URL:    "http://localhost",
		},
		{
			Path:   "some-api",
			Method: "GET",
			URL:    "http://localhost/api",
		},
		{
			Path:   "some-api/instances",
			Method: "GET",
			URL:    "http://localhost/api/instances/",
		},
		{
			Path:   "some-api/*",
			Method: "GET",
			URL:    "http://localhost/api",
		},
		{
			Path:   "some-api/instances/*",
			Method: "GET",
			URL:    "http://localhost/api/instances",
		},
		{
			Path:   "some-other-api/*",
			Method: "GET",
			URL:    "http://localhost/api/v2",
		},
		{
			Path:   "some-other-api/instances/*",
			Method: "GET",
			URL:    "http://localhost/api/v2/instances",
		},
		{
			Path:   "/mypath/*",
			Method: "GET",
			URL:    "https://example.com/api/v1/",
		},
	}

	tcs := []struct {
		proxyPath       string
		withFeatures    []any
		expectedURLPath string
		expectedStatus  int
	}{
		{
			proxyPath:      "/notexists",
			expectedStatus: http.StatusNotFound,
		},
		{
			proxyPath:       "/",
			expectedURLPath: "/",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/some-api",
			expectedURLPath: "/api",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/some-api/instances",
			expectedURLPath: "/api/instances/",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/some-api/some/thing",
			expectedURLPath: "/api/some/thing",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/some-api/instances/instance-one",
			expectedURLPath: "/api/instances/instance-one",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/some-other-api/some/thing",
			expectedURLPath: "/api/v2/some/thing",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/some-other-api/instances/instance-one",
			expectedURLPath: "/api/v2/instances/instance-one",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/mypath/some-route/",
			expectedURLPath: "/api/v1/some-route",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/mypath/some-route/",
			withFeatures:    []any{featuremgmt.FlagPluginProxyPreserveTrailingSlash},
			expectedURLPath: "/api/v1/some-route/",
			expectedStatus:  http.StatusOK,
		},
	}

	for _, tc := range tcs {
		t.Run(fmt.Sprintf("When proxying path %q should call expected URL", tc.proxyPath), func(t *testing.T) {
			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			requestHandled := false
			requestURL := ""
			backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requestURL = r.URL.RequestURI()
				w.WriteHeader(200)
				_, _ = w.Write([]byte("I am the backend"))
				requestHandled = true
			}))
			t.Cleanup(backendServer.Close)

			backendURL, err := url.Parse(backendServer.URL)
			require.NoError(t, err)

			testRoutes := make([]*plugins.Route, len(routes))
			for i, r := range routes {
				u, err := url.Parse(r.URL)
				require.NoError(t, err)
				u.Scheme = backendURL.Scheme
				u.Host = backendURL.Host
				testRoute := *r
				testRoute.URL = u.String()
				testRoutes[i] = &testRoute
			}

			responseWriter := web.NewResponseWriter("GET", httptest.NewRecorder())

			ctx := &contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{},
				Context: &web.Context{
					Req:  httptest.NewRequest("GET", tc.proxyPath, nil),
					Resp: responseWriter,
				},
			}
			ps := &pluginsettings.DTO{
				SecureJSONData: map[string][]byte{},
			}
			cfg := &setting.Cfg{}
			proxy, err := NewPluginProxy(ps, testRoutes, ctx, tc.proxyPath, cfg, secretsService, tracing.InitializeTracerForTest(), &http.Transport{}, acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()), featuremgmt.WithFeatures(tc.withFeatures...))
			require.NoError(t, err)
			proxy.HandleRequest()

			for {
				if requestHandled || ctx.Resp.Written() {
					break
				}
			}

			require.Equal(t, tc.expectedStatus, ctx.Resp.Status())

			if tc.expectedStatus == http.StatusNotFound {
				return
			}

			require.Equal(t, tc.expectedURLPath, requestURL)
		})
	}
}

func TestPluginProxyRoutesAccessControl(t *testing.T) {
	routes := []*plugins.Route{
		{
			Path:    "settings",
			Method:  "GET",
			URL:     "http://localhost/api/settings",
			ReqRole: org.RoleAdmin, // Protected by role
		},
		{
			Path:      "projects",
			Method:    "GET",
			URL:       "http://localhost/api/projects",
			ReqAction: "test-app.projects:read", // Protected by RBAC action
		},
		{
			Path:      "home",
			Method:    "GET",
			URL:       "http://localhost/api/home",
			ReqAction: "plugins.app:access", // Protected by RBAC action with plugin scope
		},
	}

	tcs := []struct {
		proxyPath       string
		usrRole         org.RoleType
		usrPerms        map[string][]string
		expectedURLPath string
		expectedStatus  int
	}{
		{
			proxyPath:       "/settings",
			usrRole:         org.RoleAdmin,
			expectedURLPath: "/api/settings",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/settings",
			usrRole:         org.RoleViewer,
			expectedURLPath: "/api/settings",
			expectedStatus:  http.StatusForbidden,
		},
		{
			proxyPath:       "/projects",
			usrPerms:        map[string][]string{"test-app.projects:read": {}},
			expectedURLPath: "/api/projects",
			expectedStatus:  http.StatusOK,
		},
		{
			proxyPath:       "/projects",
			usrPerms:        map[string][]string{},
			expectedURLPath: "/api/projects",
			expectedStatus:  http.StatusForbidden,
		},
		{
			proxyPath:       "/home",
			usrPerms:        map[string][]string{"plugins.app:access": {"plugins:id:not-the-test-app"}},
			expectedURLPath: "/api/home",
			expectedStatus:  http.StatusForbidden,
		},
		{
			proxyPath:       "/home",
			usrPerms:        map[string][]string{"plugins.app:access": {"plugins:id:test-app"}},
			expectedURLPath: "/api/home",
			expectedStatus:  http.StatusOK,
		},
	}

	for _, tc := range tcs {
		t.Run(fmt.Sprintf("Should enforce RBAC when proxying path %s %s", tc.proxyPath, http.StatusText(tc.expectedStatus)), func(t *testing.T) {
			secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
			requestHandled := false
			requestURL := ""
			backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requestURL = r.URL.RequestURI()
				w.WriteHeader(200)
				_, _ = w.Write([]byte("I am the backend"))
				requestHandled = true
			}))
			t.Cleanup(backendServer.Close)

			backendURL, err := url.Parse(backendServer.URL)
			require.NoError(t, err)

			testRoutes := make([]*plugins.Route, len(routes))
			for i, r := range routes {
				u, err := url.Parse(r.URL)
				require.NoError(t, err)
				u.Scheme = backendURL.Scheme
				u.Host = backendURL.Host
				testRoute := *r
				testRoute.URL = u.String()
				testRoutes[i] = &testRoute
			}

			responseWriter := web.NewResponseWriter("GET", httptest.NewRecorder())

			ctx := &contextmodel.ReqContext{
				Logger: logger.New("pluginproxy-test"),
				SignedInUser: &user.SignedInUser{
					OrgID:       1,
					OrgRole:     tc.usrRole,
					Permissions: map[int64]map[string][]string{1: tc.usrPerms},
				},
				Context: &web.Context{
					Req:  httptest.NewRequest("GET", tc.proxyPath, nil),
					Resp: responseWriter,
				},
			}
			ps := &pluginsettings.DTO{
				PluginID:       "test-app",
				SecureJSONData: map[string][]byte{},
			}
			cfg := &setting.Cfg{}
			proxy, err := NewPluginProxy(ps, testRoutes, ctx, tc.proxyPath, cfg, secretsService, tracing.InitializeTracerForTest(), &http.Transport{}, acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()), featuremgmt.WithFeatures(featuremgmt.FlagAccessControlOnCall))
			require.NoError(t, err)
			proxy.HandleRequest()

			for {
				if requestHandled || ctx.Resp.Written() {
					break
				}
			}

			require.Equal(t, tc.expectedStatus, ctx.Resp.Status())

			if tc.expectedStatus == http.StatusForbidden {
				return
			}

			require.Equal(t, tc.expectedURLPath, requestURL)
		})
	}
}

// getPluginProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getPluginProxiedRequest(t *testing.T, ps *pluginsettings.DTO, secretsService secrets.Service, ctx *contextmodel.ReqContext, cfg *setting.Cfg, route *plugins.Route) *http.Request {
	// insert dummy route if none is specified
	if route == nil {
		route = &plugins.Route{
			Path:    "api/v4/",
			URL:     "https://www.google.com",
			ReqRole: org.RoleEditor,
		}
	}
	proxy, err := NewPluginProxy(ps, []*plugins.Route{}, ctx, "", cfg, secretsService, tracing.InitializeTracerForTest(), &http.Transport{}, acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()), featuremgmt.WithFeatures())
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodGet, "/api/plugin-proxy/grafana-simple-app/api/v4/alerts", nil)
	require.NoError(t, err)
	proxy.matchedRoute = route
	proxy.director(req)
	return req
}
