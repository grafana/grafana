package pluginproxy

import (
	"context"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"
)

func TestPluginProxy(t *testing.T) {
	t.Run("When getting proxy headers", func(t *testing.T) {
		route := &plugins.AppPluginRoute{
			Headers: []plugins.AppPluginRouteHeader{
				{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
			},
		}

		setting.SecretKey = "password"

		bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
			key, err := ossencryption.ProvideService().Encrypt(ctx, []byte("123"), "password")
			if err != nil {
				return err
			}

			query.Result = &models.PluginSetting{
				SecureJsonData: map[string][]byte{
					"key": key,
				},
			}
			return nil
		})

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &macaron.Context{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &macaron.Context{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &macaron.Context{
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
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{IsAnonymous: true},
				Context: &macaron.Context{
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
		route := &plugins.AppPluginRoute{
			URL:    "{{.JsonData.dynamicUrl}}",
			Method: "GET",
		}

		bus.AddHandlerCtx("test", func(_ context.Context, query *models.GetPluginSettingByIdQuery) error {
			query.Result = &models.PluginSetting{
				JsonData: map[string]interface{}{
					"dynamicUrl": "https://dynamic.grafana.com",
				},
			}
			return nil
		})

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &macaron.Context{
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
		route := &plugins.AppPluginRoute{
			URL:    "{{if .JsonData.apiHost}}{{.JsonData.apiHost}}{{else}}https://example.com{{end}}",
			Method: "GET",
		}

		bus.AddHandler("test", func(query *models.GetPluginSettingByIdQuery) error {
			query.Result = &models.PluginSetting{}
			return nil
		})

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &macaron.Context{
					Req: httpReq,
				},
			},
			&setting.Cfg{SendUserHeader: true},
			route,
		)
		assert.Equal(t, "https://example.com", req.URL.String())
	})

	t.Run("When getting templated body", func(t *testing.T) {
		route := &plugins.AppPluginRoute{
			Path: "api/body",
			URL:  "http://www.test.com",
			Body: []byte(`{ "url": "{{.JsonData.dynamicUrl}}", "secret": "{{.SecureJsonData.key}}"	}`),
		}

		bus.AddHandlerCtx("test", func(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
			secretsService := secrets.SetupTestService(t)
			encryptedJsonData, err := secretsService.EncryptJsonData(
				ctx,
				map[string]string{"key": "123"},
				secrets.WithoutScope(),
			)

			if err != nil {
				return err
			}

			query.Result = &models.PluginSetting{
				JsonData: map[string]interface{}{
					"dynamicUrl": "https://dynamic.grafana.com",
				},
				SecureJsonData: encryptedJsonData,
			}
			return nil
		})

		httpReq, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)

		req := getPluginProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
				Context: &macaron.Context{
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
}

// getPluginProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getPluginProxiedRequest(t *testing.T, ctx *models.ReqContext, cfg *setting.Cfg, route *plugins.AppPluginRoute) *http.Request {
	// insert dummy route if none is specified
	if route == nil {
		route = &plugins.AppPluginRoute{
			Path:    "api/v4/",
			URL:     "https://www.google.com",
			ReqRole: models.ROLE_EDITOR,
		}
	}
	proxy := NewApiPluginProxy(ctx, "", route, "", cfg, secrets.SetupTestService(t))

	req, err := http.NewRequest(http.MethodGet, "/api/plugin-proxy/grafana-simple-app/api/v4/alerts", nil)
	require.NoError(t, err)
	proxy.Director(req)
	return req
}
