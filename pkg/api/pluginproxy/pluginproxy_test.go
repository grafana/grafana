package pluginproxy

import (
	"context"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPluginProxy(t *testing.T) {
	setting.SecretKey = "password"
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{IsAnonymous: true},
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
				JSONData: map[string]interface{}{
					"dynamicUrl": "https://dynamic.grafana.com",
				},
			},
			secretsService,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
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
				JSONData:       map[string]interface{}{"dynamicUrl": "https://dynamic.grafana.com"},
				SecureJSONData: encryptedJsonData,
			},
			secretsService,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &web.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)
		content, err := ioutil.ReadAll(req.Body)
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

		ctx := &models.ReqContext{
			SignedInUser: &models.SignedInUser{},
			Context: &web.Context{
				Req:  httptest.NewRequest("GET", "/", nil),
				Resp: responseWriter,
			},
		}
		ps := &pluginsettings.DTO{
			SecureJSONData: map[string][]byte{},
		}
		proxy, err := NewPluginProxy(ps, routes, ctx, "", &setting.Cfg{}, secretsService, tracing.InitializeTracerForTest(), &http.Transport{})
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

// getPluginProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getPluginProxiedRequest(t *testing.T, ps *pluginsettings.DTO, secretsService secrets.Service, ctx *models.ReqContext, cfg *setting.Cfg, route *plugins.Route) *http.Request {
	// insert dummy route if none is specified
	if route == nil {
		route = &plugins.Route{
			Path:    "api/v4/",
			URL:     "https://www.google.com",
			ReqRole: models.ROLE_EDITOR,
		}
	}
	proxy, err := NewPluginProxy(ps, []*plugins.Route{}, ctx, "", cfg, secretsService, tracing.InitializeTracerForTest(), &http.Transport{})
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodGet, "/api/plugin-proxy/grafana-simple-app/api/v4/alerts", nil)
	require.NoError(t, err)
	proxy.matchedRoute = route
	proxy.director(req)
	return req
}
