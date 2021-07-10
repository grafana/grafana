package pluginproxy

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	macaron "gopkg.in/macaron.v1"
)

func TestDataSourceProxy_routeRule(t *testing.T) {
	httpClientProvider := httpclient.NewProvider()

	t.Run("Plugin with routes", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{
			Routes: []*plugins.AppPluginRoute{
				{
					Path:    "api/v4/",
					URL:     "https://www.google.com",
					ReqRole: models.ROLE_EDITOR,
					Headers: []plugins.AppPluginRouteHeader{
						{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
					},
				},
				{
					Path:    "api/admin",
					URL:     "https://www.google.com",
					ReqRole: models.ROLE_ADMIN,
					Headers: []plugins.AppPluginRouteHeader{
						{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
					},
				},
				{
					Path: "api/anon",
					URL:  "https://www.google.com",
					Headers: []plugins.AppPluginRouteHeader{
						{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
					},
				},
				{
					Path: "api/common",
					URL:  "{{.JsonData.dynamicUrl}}",
					URLParams: []plugins.AppPluginRouteURLParam{
						{Name: "{{.JsonData.queryParam}}", Content: "{{.SecureJsonData.key}}"},
					},
					Headers: []plugins.AppPluginRouteHeader{
						{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
					},
				},
				{
					Path:    "api/restricted",
					ReqRole: models.ROLE_ADMIN,
				},
				{
					Path: "api/body",
					URL:  "http://www.test.com",
					Body: []byte(`{ "url": "{{.JsonData.dynamicUrl}}", "secret": "{{.SecureJsonData.key}}"	}`),
				},
			},
		}

		origSecretKey := setting.SecretKey
		t.Cleanup(func() {
			setting.SecretKey = origSecretKey
		})
		setting.SecretKey = "password" //nolint:goconst

		key, err := util.Encrypt([]byte("123"), "password")
		require.NoError(t, err)

		ds := &models.DataSource{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"clientId":   "asd",
				"dynamicUrl": "https://dynamic.grafana.com",
				"queryParam": "apiKey",
			}),
			SecureJsonData: map[string][]byte{
				"key": key,
			},
		}

		setUp := func() (*models.ReqContext, *http.Request) {
			req, err := http.NewRequest("GET", "http://localhost/asd", nil)
			require.NoError(t, err)
			ctx := &models.ReqContext{
				Context: &macaron.Context{
					Req: macaron.Request{Request: req},
				},
				SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR},
			}
			return ctx, req
		}

		cfg := &setting.Cfg{}

		t.Run("When matching route path", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := NewDataSourceProxy(ds, plugin, ctx, "api/v4/some/method", cfg, httpClientProvider, &oauthtoken.Service{})
			require.NoError(t, err)
			proxy.route = plugin.Routes[0]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds, cfg)

			assert.Equal(t, "https://www.google.com/some/method", req.URL.String())
			assert.Equal(t, "my secret 123", req.Header.Get("x-header"))
		})

		t.Run("When matching route path and has dynamic url", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := NewDataSourceProxy(ds, plugin, ctx, "api/common/some/method", cfg, httpClientProvider, &oauthtoken.Service{})
			require.NoError(t, err)
			proxy.route = plugin.Routes[3]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds, cfg)

			assert.Equal(t, "https://dynamic.grafana.com/some/method?apiKey=123", req.URL.String())
			assert.Equal(t, "my secret 123", req.Header.Get("x-header"))
		})

		t.Run("When matching route path with no url", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := NewDataSourceProxy(ds, plugin, ctx, "", cfg, httpClientProvider, &oauthtoken.Service{})
			require.NoError(t, err)
			proxy.route = plugin.Routes[4]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds, cfg)

			assert.Equal(t, "http://localhost/asd", req.URL.String())
		})

		t.Run("When matching route path and has dynamic body", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := NewDataSourceProxy(ds, plugin, ctx, "api/body", cfg, httpClientProvider, &oauthtoken.Service{})
			require.NoError(t, err)
			proxy.route = plugin.Routes[5]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.route, proxy.ds, cfg)

			content, err := ioutil.ReadAll(req.Body)
			require.NoError(t, err)
			require.Equal(t, `{ "url": "https://dynamic.grafana.com", "secret": "123"	}`, string(content))
		})

		t.Run("Validating request", func(t *testing.T) {
			t.Run("plugin route with valid role", func(t *testing.T) {
				ctx, _ := setUp()
				proxy, err := NewDataSourceProxy(ds, plugin, ctx, "api/v4/some/method", cfg, httpClientProvider, &oauthtoken.Service{})
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.NoError(t, err)
			})

			t.Run("plugin route with admin role and user is editor", func(t *testing.T) {
				ctx, _ := setUp()
				proxy, err := NewDataSourceProxy(ds, plugin, ctx, "api/admin", cfg, httpClientProvider, &oauthtoken.Service{})
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.Error(t, err)
			})

			t.Run("plugin route with admin role and user is admin", func(t *testing.T) {
				ctx, _ := setUp()
				ctx.SignedInUser.OrgRole = models.ROLE_ADMIN
				proxy, err := NewDataSourceProxy(ds, plugin, ctx, "api/admin", cfg, httpClientProvider, &oauthtoken.Service{})
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.NoError(t, err)
			})
		})
	})

	t.Run("Plugin with multiple routes for token auth", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{
			Routes: []*plugins.AppPluginRoute{
				{
					Path: "pathwithtoken1",
					URL:  "https://api.nr1.io/some/path",
					TokenAuth: &plugins.JwtTokenAuth{
						Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
						Params: map[string]string{
							"grant_type":    "client_credentials",
							"client_id":     "{{.JsonData.clientId}}",
							"client_secret": "{{.SecureJsonData.clientSecret}}",
							"resource":      "https://api.nr1.io",
						},
					},
				},
				{
					Path: "pathwithtoken2",
					URL:  "https://api.nr2.io/some/path",
					TokenAuth: &plugins.JwtTokenAuth{
						Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
						Params: map[string]string{
							"grant_type":    "client_credentials",
							"client_id":     "{{.JsonData.clientId}}",
							"client_secret": "{{.SecureJsonData.clientSecret}}",
							"resource":      "https://api.nr2.io",
						},
					},
				},
			},
		}

		origSecretKey := setting.SecretKey
		t.Cleanup(func() {
			setting.SecretKey = origSecretKey
		})
		setting.SecretKey = "password"

		key, err := util.Encrypt([]byte("123"), "password")
		require.NoError(t, err)

		ds := &models.DataSource{
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"clientId": "asd",
				"tenantId": "mytenantId",
			}),
			SecureJsonData: map[string][]byte{
				"clientSecret": key,
			},
		}

		req, err := http.NewRequest("GET", "http://localhost/asd", nil)
		require.NoError(t, err)
		ctx := &models.ReqContext{
			Context: &macaron.Context{
				Req: macaron.Request{Request: req},
			},
			SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR},
		}

		t.Run("When creating and caching access tokens", func(t *testing.T) {
			var authorizationHeaderCall1 string
			var authorizationHeaderCall2 string

			t.Run("first call should add authorization header with access token", func(t *testing.T) {
				json, err := ioutil.ReadFile("./test-data/access-token-1.json")
				require.NoError(t, err)

				originalClient := client
				client = newFakeHTTPClient(t, json)
				defer func() { client = originalClient }()

				cfg := &setting.Cfg{}

				proxy, err := NewDataSourceProxy(ds, plugin, ctx, "pathwithtoken1", cfg, httpClientProvider, &oauthtoken.Service{})
				require.NoError(t, err)
				ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, plugin.Routes[0], proxy.ds, cfg)

				authorizationHeaderCall1 = req.Header.Get("Authorization")
				assert.Equal(t, "https://api.nr1.io/some/path", req.URL.String())
				assert.True(t, strings.HasPrefix(authorizationHeaderCall1, "Bearer eyJ0e"))

				t.Run("second call to another route should add a different access token", func(t *testing.T) {
					json2, err := ioutil.ReadFile("./test-data/access-token-2.json")
					require.NoError(t, err)

					req, err := http.NewRequest("GET", "http://localhost/asd", nil)
					require.NoError(t, err)
					client = newFakeHTTPClient(t, json2)
					proxy, err := NewDataSourceProxy(ds, plugin, ctx, "pathwithtoken2", cfg, httpClientProvider, &oauthtoken.Service{})
					require.NoError(t, err)
					ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, plugin.Routes[1], proxy.ds, cfg)

					authorizationHeaderCall2 = req.Header.Get("Authorization")

					assert.Equal(t, "https://api.nr2.io/some/path", req.URL.String())
					assert.True(t, strings.HasPrefix(authorizationHeaderCall1, "Bearer eyJ0e"))
					assert.True(t, strings.HasPrefix(authorizationHeaderCall2, "Bearer eyJ0e"))
					assert.NotEqual(t, authorizationHeaderCall1, authorizationHeaderCall2)

					t.Run("third call to first route should add cached access token", func(t *testing.T) {
						req, err := http.NewRequest("GET", "http://localhost/asd", nil)
						require.NoError(t, err)

						client = newFakeHTTPClient(t, []byte{})
						proxy, err := NewDataSourceProxy(ds, plugin, ctx, "pathwithtoken1", cfg, httpClientProvider, &oauthtoken.Service{})
						require.NoError(t, err)
						ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, plugin.Routes[0], proxy.ds, cfg)

						authorizationHeaderCall3 := req.Header.Get("Authorization")
						assert.Equal(t, "https://api.nr1.io/some/path", req.URL.String())
						assert.True(t, strings.HasPrefix(authorizationHeaderCall1, "Bearer eyJ0e"))
						assert.True(t, strings.HasPrefix(authorizationHeaderCall3, "Bearer eyJ0e"))
						assert.Equal(t, authorizationHeaderCall1, authorizationHeaderCall3)
					})
				})
			})
		})
	})

	t.Run("When proxying graphite", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{}
		ds := &models.DataSource{Url: "htttp://graphite:8080", Type: models.DS_GRAPHITE}
		ctx := &models.ReqContext{}

		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/render", &setting.Cfg{BuildVersion: "5.3.0"}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)
		req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		require.NoError(t, err)

		proxy.director(req)

		t.Run("Can translate request URL and path", func(t *testing.T) {
			assert.Equal(t, "graphite:8080", req.URL.Host)
			assert.Equal(t, "/render", req.URL.Path)
		})
	})

	t.Run("When proxying InfluxDB", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{}

		ds := &models.DataSource{
			Type:     models.DS_INFLUXDB_08,
			Url:      "http://influxdb:8083",
			Database: "site",
			User:     "user",
			Password: "password",
		}

		ctx := &models.ReqContext{}
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		require.NoError(t, err)

		proxy.director(req)
		assert.Equal(t, "/db/site/", req.URL.Path)
	})

	t.Run("When proxying a data source with no keepCookies specified", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{}

		json, err := simplejson.NewJson([]byte(`{"keepCookies": []}`))
		require.NoError(t, err)

		ds := &models.DataSource{
			Type:     models.DS_GRAPHITE,
			Url:      "http://graphite:8086",
			JsonData: json,
		}

		ctx := &models.ReqContext{}
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		requestURL, err := url.Parse("http://grafana.com/sub")
		require.NoError(t, err)
		req := http.Request{URL: requestURL, Header: make(http.Header)}
		cookies := "grafana_user=admin; grafana_remember=99; grafana_sess=11; JSESSION_ID=test"
		req.Header.Set("Cookie", cookies)

		proxy.director(&req)

		assert.Equal(t, "", req.Header.Get("Cookie"))
	})

	t.Run("When proxying a data source with keep cookies specified", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{}

		json, err := simplejson.NewJson([]byte(`{"keepCookies": ["JSESSION_ID"]}`))
		require.NoError(t, err)

		ds := &models.DataSource{
			Type:     models.DS_GRAPHITE,
			Url:      "http://graphite:8086",
			JsonData: json,
		}

		ctx := &models.ReqContext{}
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		requestURL, err := url.Parse("http://grafana.com/sub")
		require.NoError(t, err)
		req := http.Request{URL: requestURL, Header: make(http.Header)}
		cookies := "grafana_user=admin; grafana_remember=99; grafana_sess=11; JSESSION_ID=test"
		req.Header.Set("Cookie", cookies)

		proxy.director(&req)

		assert.Equal(t, "JSESSION_ID=test", req.Header.Get("Cookie"))
	})

	t.Run("When proxying a custom datasource", func(t *testing.T) {
		plugin := &plugins.DataSourcePlugin{}
		ds := &models.DataSource{
			Type: "custom-datasource",
			Url:  "http://host/root/",
		}
		ctx := &models.ReqContext{}
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/path/to/folder/", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)
		req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		req.Header.Set("Origin", "grafana.com")
		req.Header.Set("Referer", "grafana.com")
		req.Header.Set("X-Canary", "stillthere")
		require.NoError(t, err)

		proxy.director(req)

		assert.Equal(t, "http://host/root/path/to/folder/", req.URL.String())

		assert.Empty(t, req.Header.Get("Origin"))
		assert.Empty(t, req.Header.Get("Referer"))
		assert.Equal(t, "stillthere", req.Header.Get("X-Canary"))
	})

	t.Run("When proxying a datasource that has OAuth token pass-through enabled", func(t *testing.T) {
		bus.AddHandler("test", func(query *models.GetAuthInfoQuery) error {
			query.Result = &models.UserAuth{
				Id:                1,
				UserId:            1,
				AuthModule:        "generic_oauth",
				OAuthAccessToken:  "testtoken",
				OAuthRefreshToken: "testrefreshtoken",
				OAuthTokenType:    "Bearer",
				OAuthExpiry:       time.Now().AddDate(0, 0, 1),
			}
			return nil
		})

		plugin := &plugins.DataSourcePlugin{}
		ds := &models.DataSource{
			Type: "custom-datasource",
			Url:  "http://host/root/",
			JsonData: simplejson.NewFromAny(map[string]interface{}{
				"oauthPassThru": true,
			}),
		}

		req, err := http.NewRequest("GET", "http://localhost/asd", nil)
		require.NoError(t, err)
		ctx := &models.ReqContext{
			SignedInUser: &models.SignedInUser{UserId: 1},
			Context: &macaron.Context{
				Req: macaron.Request{Request: req},
			},
		}
		mockAuthToken := mockOAuthTokenService{
			token: &oauth2.Token{
				AccessToken:  "testtoken",
				RefreshToken: "testrefreshtoken",
				TokenType:    "Bearer",
				Expiry:       time.Now().AddDate(0, 0, 1),
			},
			oAuthEnabled: true,
		}
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/path/to/folder/", &setting.Cfg{}, httpClientProvider, &mockAuthToken)
		require.NoError(t, err)
		req, err = http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		require.NoError(t, err)

		proxy.director(req)

		assert.Equal(t, "Bearer testtoken", req.Header.Get("Authorization"))
	})

	t.Run("When SendUserHeader config is enabled", func(t *testing.T) {
		req := getDatasourceProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: true},
		)
		assert.Equal(t, "test_user", req.Header.Get("X-Grafana-User"))
	})

	t.Run("When SendUserHeader config is disabled", func(t *testing.T) {
		req := getDatasourceProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{
					Login: "test_user",
				},
			},
			&setting.Cfg{SendUserHeader: false},
		)
		// Get will return empty string even if header is not set
		assert.Empty(t, req.Header.Get("X-Grafana-User"))
	})

	t.Run("When SendUserHeader config is enabled but user is anonymous", func(t *testing.T) {
		req := getDatasourceProxiedRequest(
			t,
			&models.ReqContext{
				SignedInUser: &models.SignedInUser{IsAnonymous: true},
			},
			&setting.Cfg{SendUserHeader: true},
		)
		// Get will return empty string even if header is not set
		assert.Empty(t, req.Header.Get("X-Grafana-User"))
	})

	t.Run("When proxying data source proxy should handle authentication", func(t *testing.T) {
		tests := []*testCase{
			createAuthTest(t, models.DS_INFLUXDB_08, authTypePassword, authCheckQuery, false),
			createAuthTest(t, models.DS_INFLUXDB_08, authTypePassword, authCheckQuery, true),
			createAuthTest(t, models.DS_INFLUXDB, authTypePassword, authCheckHeader, true),
			createAuthTest(t, models.DS_INFLUXDB, authTypePassword, authCheckHeader, false),
			createAuthTest(t, models.DS_INFLUXDB, authTypeBasic, authCheckHeader, true),
			createAuthTest(t, models.DS_INFLUXDB, authTypeBasic, authCheckHeader, false),

			// These two should be enough for any other datasource at the moment. Proxy has special handling
			// only for Influx, others have the same path and only BasicAuth. Non BasicAuth datasources
			// do not go through proxy but through TSDB API which is not tested here.
			createAuthTest(t, models.DS_ES, authTypeBasic, authCheckHeader, false),
			createAuthTest(t, models.DS_ES, authTypeBasic, authCheckHeader, true),
		}
		for _, test := range tests {
			models.ClearDSDecryptionCache()
			runDatasourceAuthTest(t, test)
		}
	})
}

// test DataSourceProxy request handling.
func TestDataSourceProxy_requestHandling(t *testing.T) {
	httpClientProvider := httpclient.NewProvider()
	var writeErr error

	plugin := &plugins.DataSourcePlugin{}

	type setUpCfg struct {
		headers map[string]string
		writeCb func(w http.ResponseWriter, r *http.Request)
	}

	setUp := func(t *testing.T, cfgs ...setUpCfg) (*models.ReqContext, *models.DataSource) {
		writeErr = nil

		backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.SetCookie(w, &http.Cookie{Name: "flavor", Value: "chocolateChip"})
			written := false
			for _, cfg := range cfgs {
				if cfg.writeCb != nil {
					t.Log("Writing response via callback")
					cfg.writeCb(w, r)
					written = true
				}
			}
			if !written {
				t.Log("Writing default response")
				w.WriteHeader(200)
				_, writeErr = w.Write([]byte("I am the backend"))
			}
		}))
		t.Cleanup(backend.Close)

		ds := &models.DataSource{Url: backend.URL, Type: models.DS_GRAPHITE}

		responseRecorder := &closeNotifierResponseRecorder{
			ResponseRecorder: httptest.NewRecorder(),
		}
		t.Cleanup(responseRecorder.Close)

		responseWriter := macaron.NewResponseWriter("GET", responseRecorder)

		// XXX: Really unsure why, but setting headers within the HTTP handler function doesn't stick,
		// so doing it here instead
		for _, cfg := range cfgs {
			for k, v := range cfg.headers {
				responseWriter.Header().Set(k, v)
			}
		}

		return &models.ReqContext{
			SignedInUser: &models.SignedInUser{},
			Context: &macaron.Context{
				Req: macaron.Request{
					Request: httptest.NewRequest("GET", "/render", nil),
				},
				Resp: responseWriter,
			},
		}, ds
	}

	t.Run("When response header Set-Cookie is not set should remove proxied Set-Cookie header", func(t *testing.T) {
		ctx, ds := setUp(t)
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/render", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		assert.Empty(t, proxy.ctx.Resp.Header().Get("Set-Cookie"))
	})

	t.Run("When response header Set-Cookie is set should remove proxied Set-Cookie header and restore the original Set-Cookie header", func(t *testing.T) {
		ctx, ds := setUp(t, setUpCfg{
			headers: map[string]string{
				"Set-Cookie": "important_cookie=important_value",
			},
		})
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/render", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		assert.Equal(t, "important_cookie=important_value", proxy.ctx.Resp.Header().Get("Set-Cookie"))
	})

	t.Run("Data source returns status code 401", func(t *testing.T) {
		ctx, ds := setUp(t, setUpCfg{
			writeCb: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(401)
				w.Header().Set("www-authenticate", `Basic realm="Access to the server"`)
				_, err := w.Write([]byte("Not authenticated"))
				require.NoError(t, err)
				t.Log("Wrote 401 response")
			},
		})
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/render", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		assert.Equal(t, 400, proxy.ctx.Resp.Status(), "Status code 401 should be converted to 400")
		assert.Empty(t, proxy.ctx.Resp.Header().Get("www-authenticate"))
	})

	t.Run("Data source should handle proxy path url encoding correctly", func(t *testing.T) {
		var req *http.Request
		ctx, ds := setUp(t, setUpCfg{
			writeCb: func(w http.ResponseWriter, r *http.Request) {
				req = r
				w.WriteHeader(200)
				_, err := w.Write([]byte("OK"))
				require.NoError(t, err)
			},
		})

		ctx.Req.Request = httptest.NewRequest("GET", "/api/datasources/proxy/1/path/%2Ftest%2Ftest%2F?query=%2Ftest%2Ftest%2F", nil)
		proxy, err := NewDataSourceProxy(ds, plugin, ctx, "/path/%2Ftest%2Ftest%2F", &setting.Cfg{}, httpClientProvider, &oauthtoken.Service{})
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		require.NotNil(t, req)
		require.Equal(t, "/path/%2Ftest%2Ftest%2F?query=%2Ftest%2Ftest%2F", req.RequestURI)
	})
}

func TestNewDataSourceProxy_InvalidURL(t *testing.T) {
	ctx := models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{},
		},
		SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR},
	}
	ds := models.DataSource{
		Type: "test",
		Url:  "://host/root",
	}
	cfg := setting.Cfg{}
	plugin := plugins.DataSourcePlugin{}
	_, err := NewDataSourceProxy(&ds, &plugin, &ctx, "api/method", &cfg, httpclient.NewProvider(), &oauthtoken.Service{})
	require.Error(t, err)
	assert.True(t, strings.HasPrefix(err.Error(), `validation of data source URL "://host/root" failed`))
}

func TestNewDataSourceProxy_ProtocolLessURL(t *testing.T) {
	ctx := models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{},
		},
		SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR},
	}
	ds := models.DataSource{
		Type: "test",
		Url:  "127.0.01:5432",
	}
	cfg := setting.Cfg{}
	plugin := plugins.DataSourcePlugin{}

	_, err := NewDataSourceProxy(&ds, &plugin, &ctx, "api/method", &cfg, httpclient.NewProvider(), &oauthtoken.Service{})

	require.NoError(t, err)
}

// Test wth MSSQL type data sources.
func TestNewDataSourceProxy_MSSQL(t *testing.T) {
	ctx := models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{},
		},
		SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_EDITOR},
	}
	tcs := []struct {
		description string
		url         string
		err         error
	}{
		{
			description: "Valid ODBC URL",
			url:         `localhost\instance:1433`,
		},
		{
			description: "Invalid ODBC URL",
			url:         `localhost\instance::1433`,
			err: datasource.URLValidationError{
				Err: fmt.Errorf(`unrecognized MSSQL URL format: "localhost\\instance::1433"`),
				URL: `localhost\instance::1433`,
			},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.description, func(t *testing.T) {
			cfg := setting.Cfg{}
			plugin := plugins.DataSourcePlugin{}
			ds := models.DataSource{
				Type: "mssql",
				Url:  tc.url,
			}

			p, err := NewDataSourceProxy(&ds, &plugin, &ctx, "api/method", &cfg, httpclient.NewProvider(), &oauthtoken.Service{})
			if tc.err == nil {
				require.NoError(t, err)
				assert.Equal(t, &url.URL{
					Scheme: "sqlserver",
					Host:   ds.Url,
				}, p.targetUrl)
			} else {
				require.Error(t, err)
				assert.Equal(t, tc.err, err)
			}
		})
	}
}

type closeNotifierResponseRecorder struct {
	*httptest.ResponseRecorder
	closeChan chan bool
}

func (r *closeNotifierResponseRecorder) CloseNotify() <-chan bool {
	r.closeChan = make(chan bool)
	return r.closeChan
}

func (r *closeNotifierResponseRecorder) Close() {
	close(r.closeChan)
}

// getDatasourceProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getDatasourceProxiedRequest(t *testing.T, ctx *models.ReqContext, cfg *setting.Cfg) *http.Request {
	plugin := &plugins.DataSourcePlugin{}

	ds := &models.DataSource{
		Type: "custom",
		Url:  "http://host/root/",
	}

	proxy, err := NewDataSourceProxy(ds, plugin, ctx, "", cfg, httpclient.NewProvider(), &oauthtoken.Service{})
	require.NoError(t, err)
	req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
	require.NoError(t, err)

	proxy.director(req)
	return req
}

type httpClientStub struct {
	t        *testing.T
	fakeBody []byte
}

func (c *httpClientStub) Do(req *http.Request) (*http.Response, error) {
	bodyJSON, err := simplejson.NewJson(c.fakeBody)
	require.NoError(c.t, err)
	_, passedTokenCacheTest := bodyJSON.CheckGet("expires_on")
	require.True(c.t, passedTokenCacheTest)

	bodyJSON.Set("expires_on", fmt.Sprint(time.Now().Add(time.Second*60).Unix()))
	body, err := bodyJSON.MarshalJSON()
	require.NoError(c.t, err)
	resp := &http.Response{
		Body: ioutil.NopCloser(bytes.NewReader(body)),
	}

	return resp, nil
}

func newFakeHTTPClient(t *testing.T, fakeBody []byte) httpClient {
	return &httpClientStub{
		t:        t,
		fakeBody: fakeBody,
	}
}

type testCase struct {
	datasource *models.DataSource
	checkReq   func(req *http.Request)
}

const (
	authTypePassword = "password"
	authTypeBasic    = "basic"
)

const (
	authCheckQuery  = "query"
	authCheckHeader = "header"
)

func createAuthTest(t *testing.T, dsType string, authType string, authCheck string, useSecureJsonData bool) *testCase {
	// Basic user:password
	base64AuthHeader := "Basic dXNlcjpwYXNzd29yZA=="

	test := &testCase{
		datasource: &models.DataSource{
			Id:       1,
			Type:     dsType,
			JsonData: simplejson.New(),
		},
	}
	var message string
	if authType == authTypePassword {
		message = fmt.Sprintf("%v should add username and password", dsType)
		test.datasource.User = "user"
		if useSecureJsonData {
			test.datasource.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			})
		} else {
			test.datasource.Password = "password"
		}
	} else {
		message = fmt.Sprintf("%v should add basic auth username and password", dsType)
		test.datasource.BasicAuth = true
		test.datasource.BasicAuthUser = "user"
		if useSecureJsonData {
			test.datasource.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
				"basicAuthPassword": "password",
			})
		} else {
			test.datasource.BasicAuthPassword = "password"
		}
	}

	if useSecureJsonData {
		message += " from securejsondata"
	}

	if authCheck == authCheckQuery {
		message += " to query params"
		test.checkReq = func(req *http.Request) {
			queryVals := req.URL.Query()
			assert.Equal(t, "user", queryVals["u"][0], message)
			assert.Equal(t, "password", queryVals["p"][0], message)
		}
	} else {
		message += " to auth header"
		test.checkReq = func(req *http.Request) {
			assert.Equal(t, base64AuthHeader, req.Header.Get("Authorization"), message)
		}
	}

	return test
}

func runDatasourceAuthTest(t *testing.T, test *testCase) {
	plugin := &plugins.DataSourcePlugin{}
	ctx := &models.ReqContext{}
	proxy, err := NewDataSourceProxy(test.datasource, plugin, ctx, "", &setting.Cfg{}, httpclient.NewProvider(), &oauthtoken.Service{})
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
	require.NoError(t, err)

	proxy.director(req)

	test.checkReq(req)
}

func Test_PathCheck(t *testing.T) {
	// Ensure that we test routes appropriately. This test reproduces a historical bug where two routes were defined with different role requirements but the same method and the more privileged route was tested first. Here we ensure auth checks are applied based on the correct route, not just the method.
	plugin := &plugins.DataSourcePlugin{
		Routes: []*plugins.AppPluginRoute{
			{
				Path:    "a",
				URL:     "https://www.google.com",
				ReqRole: models.ROLE_EDITOR,
				Method:  http.MethodGet,
			},
			{
				Path:    "b",
				URL:     "https://www.google.com",
				ReqRole: models.ROLE_VIEWER,
				Method:  http.MethodGet,
			},
		},
	}
	setUp := func() (*models.ReqContext, *http.Request) {
		req, err := http.NewRequest("GET", "http://localhost/asd", nil)
		require.NoError(t, err)
		ctx := &models.ReqContext{
			Context: &macaron.Context{
				Req: macaron.Request{Request: req},
			},
			SignedInUser: &models.SignedInUser{OrgRole: models.ROLE_VIEWER},
		}
		return ctx, req
	}
	ctx, _ := setUp()
	proxy, err := NewDataSourceProxy(&models.DataSource{}, plugin, ctx, "b", &setting.Cfg{}, httpclient.NewProvider(), &oauthtoken.Service{})
	require.NoError(t, err)

	require.Nil(t, proxy.validateRequest())
	require.Equal(t, plugin.Routes[1], proxy.route)
}

type mockOAuthTokenService struct {
	token        *oauth2.Token
	oAuthEnabled bool
}

func (m *mockOAuthTokenService) GetCurrentOAuthToken(ctx context.Context, user *models.SignedInUser) *oauth2.Token {
	return m.token
}

func (m *mockOAuthTokenService) IsOAuthPassThruEnabled(ds *models.DataSource) bool {
	return m.oAuthEnabled
}
