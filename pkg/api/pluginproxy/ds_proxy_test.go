package pluginproxy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	pluginfakes "github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDataSourceProxy_routeRule(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg := &setting.Cfg{}

	t.Run("Plugin with routes", func(t *testing.T) {
		routes := []*plugins.Route{
			{
				Path:    "api/v4/",
				URL:     "https://www.google.com",
				ReqRole: org.RoleEditor,
				Headers: []plugins.Header{
					{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
				},
			},
			{
				Path:    "api/admin",
				URL:     "https://www.google.com",
				ReqRole: org.RoleAdmin,
				Headers: []plugins.Header{
					{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
				},
			},
			{
				Path: "api/anon",
				URL:  "https://www.google.com",
				Headers: []plugins.Header{
					{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
				},
			},
			{
				Path: "api/common",
				URL:  "{{.JsonData.dynamicUrl}}",
				URLParams: []plugins.URLParam{
					{Name: "{{.JsonData.queryParam}}", Content: "{{.SecureJsonData.key}}"},
				},
				Headers: []plugins.Header{
					{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
				},
			},
			{
				Path:    "api/restricted",
				ReqRole: org.RoleAdmin,
			},
			{
				Path: "api/body",
				URL:  "http://www.test.com",
				Body: []byte(`{ "url": "{{.JsonData.dynamicUrl}}", "secret": "{{.SecureJsonData.key}}"	}`),
			},
			{
				Path: "mypath",
				URL:  "https://example.com/api/v1/",
			},
			{
				Path:      "api/rbac-home",
				ReqAction: "datasources:read",
			},
			{
				Path:      "api/rbac-restricted",
				ReqAction: "test-app.settings:read",
			},
			{
				Path: "encodedPath",
				URL:  "http://encoded.com",
			},
		}

		ds := &datasources.DataSource{
			UID: "dsUID",
			JsonData: simplejson.NewFromAny(map[string]any{
				"clientId":   "asd",
				"dynamicUrl": "https://dynamic.grafana.com",
				"queryParam": "apiKey",
			}),
		}

		jd, err := ds.JsonData.Map()
		require.NoError(t, err)
		dsInfo := DSInfo{
			ID:       ds.ID,
			Updated:  ds.Updated,
			JSONData: jd,
			DecryptedSecureJSONData: map[string]string{
				"key": "123",
			},
		}

		setUp := func() (*contextmodel.ReqContext, *http.Request) {
			req, err := http.NewRequest("GET", "http://localhost/asd", nil)
			require.NoError(t, err)
			ctx := &contextmodel.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor},
			}
			return ctx, req
		}

		t.Run("When matching route path", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/v4/some/method")
			require.NoError(t, err)
			proxy.matchedRoute = routes[0]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			assert.Equal(t, "https://www.google.com/some/method", req.URL.String())
			assert.Equal(t, "my secret 123", req.Header.Get("x-header"))
		})

		t.Run("When matching route path and has dynamic url", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/common/some/method")
			require.NoError(t, err)
			proxy.matchedRoute = routes[3]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			assert.Equal(t, "https://dynamic.grafana.com/some/method?apiKey=123", req.URL.String())
			assert.Equal(t, "my secret 123", req.Header.Get("x-header"))
		})

		t.Run("When matching route path with no url", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "")
			require.NoError(t, err)
			proxy.matchedRoute = routes[4]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			assert.Equal(t, "http://localhost/asd", req.URL.String())
		})

		t.Run("When matching route path and has setting url", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/common/some/method")
			require.NoError(t, err)
			proxy.matchedRoute = &plugins.Route{
				Path: "api/common",
				URL:  "{{.URL}}",
				Headers: []plugins.Header{
					{Name: "x-header", Content: "my secret {{.SecureJsonData.key}}"},
				},
				URLParams: []plugins.URLParam{
					{Name: "{{.JsonData.queryParam}}", Content: "{{.SecureJsonData.key}}"},
				},
			}

			dsInfo := DSInfo{
				ID:       ds.ID,
				Updated:  ds.Updated,
				JSONData: jd,
				DecryptedSecureJSONData: map[string]string{
					"key": "123",
				},
				URL: "https://dynamic.grafana.com",
			}
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			assert.Equal(t, "https://dynamic.grafana.com/some/method?apiKey=123", req.URL.String())
			assert.Equal(t, "my secret 123", req.Header.Get("x-header"))
		})

		t.Run("When matching route path and has dynamic body", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/body")
			require.NoError(t, err)
			proxy.matchedRoute = routes[5]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			content, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			require.Equal(t, `{ "url": "https://dynamic.grafana.com", "secret": "123"	}`, string(content))
		})

		t.Run("When matching route path ending with a slash", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "mypath/some-route/")
			require.NoError(t, err)
			proxy.matchedRoute = routes[6]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			assert.Equal(t, "https://example.com/api/v1/some-route/", req.URL.String())
		})

		t.Run("When matching proxy path is already encoded", func(t *testing.T) {
			ctx, req := setUp()
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/our%20devices")
			require.NoError(t, err)
			proxy.matchedRoute = routes[9]
			ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, proxy.matchedRoute, dsInfo, proxy.cfg)

			assert.Equal(t, "http://encoded.com/our%20devices", req.URL.String())
		})

		t.Run("Validating request", func(t *testing.T) {
			t.Run("plugin route with valid role", func(t *testing.T) {
				ctx, _ := setUp()
				proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/v4/some/method")
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.NoError(t, err)
			})

			t.Run("plugin route with admin role and user is editor", func(t *testing.T) {
				ctx, _ := setUp()
				proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/admin")
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.Error(t, err)
			})

			t.Run("plugin route with admin role and user is admin", func(t *testing.T) {
				ctx, _ := setUp()
				ctx.OrgRole = org.RoleAdmin
				proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/admin")
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.NoError(t, err)
			})

			t.Run("path with slashes and user is editor", func(t *testing.T) {
				ctx, _ := setUp()
				proxy, err := setupDSProxyTest(t, ctx, ds, routes, "//api//admin")
				require.NoError(t, err)
				err = proxy.validateRequest()
				require.Error(t, err)
			})
		})

		t.Run("plugin route with RBAC protection user is allowed", func(t *testing.T) {
			ctx, _ := setUp()
			ctx.OrgID = int64(1)
			ctx.OrgRole = identity.RoleNone
			ctx.Permissions = map[int64]map[string][]string{1: {"test-app.settings:read": nil}}
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/rbac-restricted")
			require.NoError(t, err)
			err = proxy.validateRequest()
			require.NoError(t, err)
		})

		t.Run("plugin route with RBAC protection user is not allowed", func(t *testing.T) {
			ctx, _ := setUp()
			ctx.OrgID = int64(1)
			ctx.OrgRole = identity.RoleNone
			ctx.Permissions = map[int64]map[string][]string{1: {"test-app:read": nil}}
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/rbac-restricted")
			require.NoError(t, err)
			err = proxy.validateRequest()
			require.Error(t, err)
		})

		t.Run("plugin route with dynamic RBAC protection user is allowed", func(t *testing.T) {
			ctx, _ := setUp()
			ctx.OrgID = int64(1)
			ctx.OrgRole = identity.RoleNone
			ctx.Permissions = map[int64]map[string][]string{1: {"datasources:read": {"datasources:uid:dsUID"}}}
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/rbac-home")
			require.NoError(t, err)
			err = proxy.validateRequest()
			require.NoError(t, err)
		})

		t.Run("plugin route with dynamic RBAC protection user is not allowed", func(t *testing.T) {
			ctx, _ := setUp()
			ctx.OrgID = int64(1)
			ctx.OrgRole = identity.RoleNone
			// Has access but to another app
			ctx.Permissions = map[int64]map[string][]string{1: {"datasources:read": {"datasources:uid:notTheDsUID"}}}
			proxy, err := setupDSProxyTest(t, ctx, ds, routes, "api/rbac-home")
			require.NoError(t, err)
			err = proxy.validateRequest()
			require.Error(t, err)
		})
	})

	t.Run("Plugin with multiple routes for token auth", func(t *testing.T) {
		routes := []*plugins.Route{
			{
				Path: "pathwithtoken1",
				URL:  "https://api.nr1.io/some/path",
				TokenAuth: &plugins.JWTTokenAuth{
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
				TokenAuth: &plugins.JWTTokenAuth{
					Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
					Params: map[string]string{
						"grant_type":    "client_credentials",
						"client_id":     "{{.JsonData.clientId}}",
						"client_secret": "{{.SecureJsonData.clientSecret}}",
						"resource":      "https://api.nr2.io",
					},
				},
			},
		}

		ds := &datasources.DataSource{
			JsonData: simplejson.NewFromAny(map[string]any{
				"clientId": "asd",
				"tenantId": "mytenantId",
			}),
		}

		req, err := http.NewRequest("GET", "http://localhost/asd", nil)
		require.NoError(t, err)
		ctx := &contextmodel.ReqContext{
			Context:      &web.Context{Req: req},
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor},
		}

		t.Run("When creating and caching access tokens", func(t *testing.T) {
			var authorizationHeaderCall1 string
			var authorizationHeaderCall2 string

			t.Run("first call should add authorization header with access token", func(t *testing.T) {
				json, err := os.ReadFile("./test-data/access-token-1.json")
				require.NoError(t, err)

				originalClient := client
				client = newFakeHTTPClient(t, json)
				defer func() { client = originalClient }()

				jd, err := ds.JsonData.Map()
				require.NoError(t, err)
				dsInfo := DSInfo{
					ID:       ds.ID,
					Updated:  ds.Updated,
					JSONData: jd,
					DecryptedSecureJSONData: map[string]string{
						"clientSecret": "123",
					},
				}

				proxy, err := setupDSProxyTest(t, ctx, ds, routes, "pathwithtoken1")
				require.NoError(t, err)
				ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, routes[0], dsInfo, proxy.cfg)

				authorizationHeaderCall1 = req.Header.Get("Authorization")
				assert.Equal(t, "https://api.nr1.io/some/path", req.URL.String())
				assert.True(t, strings.HasPrefix(authorizationHeaderCall1, "Bearer eyJ0e"))

				t.Run("second call to another route should add a different access token", func(t *testing.T) {
					json2, err := os.ReadFile("./test-data/access-token-2.json")
					require.NoError(t, err)

					req, err := http.NewRequest("GET", "http://localhost/asd", nil)
					require.NoError(t, err)
					client = newFakeHTTPClient(t, json2)

					proxy, err := setupDSProxyTest(t, ctx, ds, routes, "pathwithtoken2")
					require.NoError(t, err)

					ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, routes[1], dsInfo, proxy.cfg)

					authorizationHeaderCall2 = req.Header.Get("Authorization")

					assert.Equal(t, "https://api.nr2.io/some/path", req.URL.String())
					assert.True(t, strings.HasPrefix(authorizationHeaderCall1, "Bearer eyJ0e"))
					assert.True(t, strings.HasPrefix(authorizationHeaderCall2, "Bearer eyJ0e"))
					assert.NotEqual(t, authorizationHeaderCall1, authorizationHeaderCall2)

					t.Run("third call to first route should add cached access token", func(t *testing.T) {
						req, err := http.NewRequest("GET", "http://localhost/asd", nil)
						require.NoError(t, err)

						client = newFakeHTTPClient(t, []byte{})

						proxy, err := setupDSProxyTest(t, ctx, ds, routes, "pathwithtoken1")
						require.NoError(t, err)
						ApplyRoute(proxy.ctx.Req.Context(), req, proxy.proxyPath, routes[0], dsInfo, proxy.cfg)

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
		var routes []*plugins.Route
		ds := &datasources.DataSource{URL: "htttp://graphite:8080", Type: datasources.DS_GRAPHITE}
		ctx := &contextmodel.ReqContext{}

		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/render", func(proxy *DataSourceProxy) {
			proxy.cfg = &setting.Cfg{BuildVersion: "5.3.0"}
		})
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
		ds := &datasources.DataSource{
			Type:     datasources.DS_INFLUXDB_08,
			URL:      "http://influxdb:8083",
			Database: "site",
			User:     "user",
		}

		ctx := &contextmodel.ReqContext{}
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "")
		require.NoError(t, err)

		req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		require.NoError(t, err)

		proxy.director(req)
		assert.Equal(t, "/db/site/", req.URL.Path)
	})

	t.Run("When proxying a data source with no keepCookies specified", func(t *testing.T) {
		json, err := simplejson.NewJson([]byte(`{"keepCookies": []}`))
		require.NoError(t, err)

		ds := &datasources.DataSource{
			Type:     datasources.DS_GRAPHITE,
			URL:      "http://graphite:8086",
			JsonData: json,
		}

		ctx := &contextmodel.ReqContext{}
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "")
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
		json, err := simplejson.NewJson([]byte(`{"keepCookies": ["JSESSION_ID"]}`))
		require.NoError(t, err)

		ds := &datasources.DataSource{
			Type:     datasources.DS_GRAPHITE,
			URL:      "http://graphite:8086",
			JsonData: json,
		}

		ctx := &contextmodel.ReqContext{}
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "")
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
		ds := &datasources.DataSource{
			Type: "custom-datasource",
			URL:  "http://host/root/",
		}
		ctx := &contextmodel.ReqContext{}
		var routes []*plugins.Route

		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/path/to/folder/")
		require.NoError(t, err)

		req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		req.Header.Set("Origin", "grafana.com")
		req.Header.Set("Referer", "grafana.com")
		req.Header.Set("X-Canary", "stillthere")
		require.NoError(t, err)

		proxy.director(req)

		assert.Equal(t, "http://host/root/path/to/folder/", req.URL.String())

		assert.Equal(t, "stillthere", req.Header.Get("X-Canary"))
	})

	t.Run("When proxying a datasource that has OAuth token pass-through enabled", func(t *testing.T) {
		ds := &datasources.DataSource{
			Type: "custom-datasource",
			URL:  "http://host/root/",
			JsonData: simplejson.NewFromAny(map[string]any{
				"oauthPassThru": true,
			}),
		}

		req, err := http.NewRequest("GET", "http://localhost/asd", nil)
		require.NoError(t, err)
		ctx := &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{UserID: 1},
			Context:      &web.Context{Req: req},
		}

		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/path/to/folder/", func(proxy *DataSourceProxy) {
			proxy.oAuthTokenService = &oauthtokentest.MockOauthTokenService{
				GetCurrentOauthTokenFunc: func(_ context.Context, _ identity.Requester, _ *auth.UserToken) *oauth2.Token {
					return (&oauth2.Token{
						AccessToken:  "testtoken",
						RefreshToken: "testrefreshtoken",
						TokenType:    "Bearer",
						Expiry:       time.Now().AddDate(0, 0, 1),
					}).WithExtra(map[string]any{"id_token": "testidtoken"})
				},
				IsOAuthPassThruEnabledFunc: func(ds *datasources.DataSource) bool {
					return true
				},
			}
		})
		require.NoError(t, err)

		req, err = http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
		req = req.WithContext(context.WithValue(req.Context(), ctxkey.Key{}, &contextmodel.ReqContext{UserToken: nil}))
		require.NoError(t, err)

		proxy.director(req)

		assert.Equal(t, "Bearer testtoken", req.Header.Get("Authorization"))
		assert.Equal(t, "testidtoken", req.Header.Get("X-ID-Token"))
	})

	t.Run("When SendUserHeader config is enabled", func(t *testing.T) {
		req := getDatasourceProxiedRequest(
			t,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
					Login:        "test_user",
					FallbackType: claims.TypeUser,
					UserID:       1,
				},
			},
			&setting.Cfg{SendUserHeader: true},
		)
		assert.Equal(t, "test_user", req.Header.Get("X-Grafana-User"))
	})

	t.Run("When SendUserHeader config is disabled", func(t *testing.T) {
		req := getDatasourceProxiedRequest(
			t,
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{
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
			&contextmodel.ReqContext{
				SignedInUser: &user.SignedInUser{IsAnonymous: true},
			},
			&setting.Cfg{SendUserHeader: true},
		)
		// Get will return empty string even if header is not set
		assert.Empty(t, req.Header.Get("X-Grafana-User"))
	})

	t.Run("When proxying data source proxy should handle authentication", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))

		tests := []*testCase{
			createAuthTest(t, secretsStore, datasources.DS_INFLUXDB_08, "http://localhost:9090", authTypePassword, authCheckQuery),
			createAuthTest(t, secretsStore, datasources.DS_INFLUXDB_08, "http://localhost:9090", authTypePassword, authCheckQuery),
			createAuthTest(t, secretsStore, datasources.DS_INFLUXDB, "http://localhost:9090", authTypePassword, authCheckHeader),
			createAuthTest(t, secretsStore, datasources.DS_INFLUXDB, "http://localhost:9090", authTypePassword, authCheckHeader),
			createAuthTest(t, secretsStore, datasources.DS_INFLUXDB, "http://localhost:9090", authTypeBasic, authCheckHeader),
			createAuthTest(t, secretsStore, datasources.DS_INFLUXDB, "http://localhost:9090", authTypeBasic, authCheckHeader),

			// These two should be enough for any other datasource at the moment. Proxy has special handling
			// only for Influx, others have the same path and only BasicAuth. Non BasicAuth datasources
			// do not go through proxy but through TSDB API which is not tested here.
			createAuthTest(t, secretsStore, datasources.DS_ES, "http://localhost:9200", authTypeBasic, authCheckHeader),
			createAuthTest(t, secretsStore, datasources.DS_ES, "http://localhost:9200", authTypeBasic, authCheckHeader),
		}
		for _, test := range tests {
			runDatasourceAuthTest(t, secretsService, secretsStore, cfg, test)
		}
	})
}

// test DataSourceProxy request handling.
func TestDataSourceProxy_requestHandling(t *testing.T) {
	var writeErr error

	type setUpCfg struct {
		headers map[string]string
		writeCb func(w http.ResponseWriter, r *http.Request)
	}

	setUp := func(t *testing.T, cfgs ...setUpCfg) (*contextmodel.ReqContext, *datasources.DataSource) {
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

		ds := &datasources.DataSource{URL: backend.URL, Type: datasources.DS_GRAPHITE}

		responseWriter := web.NewResponseWriter("GET", httptest.NewRecorder())

		// XXX: Really unsure why, but setting headers within the HTTP handler function doesn't stick,
		// so doing it here instead
		for _, cfg := range cfgs {
			for k, v := range cfg.headers {
				responseWriter.Header().Set(k, v)
			}
		}

		return &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{},
			Context: &web.Context{
				Req:  httptest.NewRequest("GET", "/render", nil),
				Resp: responseWriter,
			},
		}, ds
	}

	t.Run("When response header Set-Cookie is not set should remove proxied Set-Cookie header", func(t *testing.T) {
		ctx, ds := setUp(t)
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/render")
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
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/render")
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		assert.Equal(t, "important_cookie=important_value", proxy.ctx.Resp.Header().Get("Set-Cookie"))
	})

	t.Run("When response should set Content-Security-Policy header", func(t *testing.T) {
		ctx, ds := setUp(t)
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/render")
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		assert.Equal(t, "sandbox", proxy.ctx.Resp.Header().Get("Content-Security-Policy"))
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
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/render")
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

		ctx.Req = httptest.NewRequest("GET", "/api/datasources/proxy/1/path/%2Ftest%2Ftest%2F?query=%2Ftest%2Ftest%2F", nil)
		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/path/%2Ftest%2Ftest%2F")
		require.NoError(t, err)

		proxy.HandleRequest()

		require.NoError(t, writeErr)
		require.NotNil(t, req)
		require.Equal(t, "/path/%2Ftest%2Ftest%2F?query=%2Ftest%2Ftest%2F", req.RequestURI)
	})

	t.Run("Data source should handle proxy path url encoding correctly with opentelemetry", func(t *testing.T) {
		var req *http.Request
		ctx, ds := setUp(t, setUpCfg{
			writeCb: func(w http.ResponseWriter, r *http.Request) {
				req = r
				w.WriteHeader(200)
				_, err := w.Write([]byte("OK"))
				require.NoError(t, err)
			},
		})

		ctx.Req = httptest.NewRequest("GET", "/api/datasources/proxy/1/path/%2Ftest%2Ftest%2F?query=%2Ftest%2Ftest%2F", nil)

		var routes []*plugins.Route
		proxy, err := setupDSProxyTest(t, ctx, ds, routes, "/path/%2Ftest%2Ftest%2F")
		require.NoError(t, err)

		proxy.HandleRequest()
		require.NoError(t, writeErr)
		require.NotNil(t, req)
		require.Equal(t, "/path/%2Ftest%2Ftest%2F?query=%2Ftest%2Ftest%2F", req.RequestURI)
	})
}

func TestNewDataSourceProxy_InvalidURL(t *testing.T) {
	ctx := contextmodel.ReqContext{
		Context:      &web.Context{},
		SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor},
	}
	ds := datasources.DataSource{
		Type: "test",
		URL:  "://host/root",
	}

	var routes []*plugins.Route
	_, err := setupDSProxyTest(t, &ctx, &ds, routes, "api/mehtod")
	require.Error(t, err)
	assert.True(t, strings.HasPrefix(err.Error(), `validation of data source URL "://host/root" failed`))
}

func TestNewDataSourceProxy_ProtocolLessURL(t *testing.T) {
	ctx := contextmodel.ReqContext{
		Context:      &web.Context{},
		SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor},
	}
	ds := datasources.DataSource{
		Type: "test",
		URL:  "127.0.01:5432",
	}

	var routes []*plugins.Route
	_, err := setupDSProxyTest(t, &ctx, &ds, routes, "api/mehtod")

	require.NoError(t, err)
}

// Test wth MSSQL type data sources.
func TestNewDataSourceProxy_MSSQL(t *testing.T) {
	ctx := contextmodel.ReqContext{
		Context:      &web.Context{},
		SignedInUser: &user.SignedInUser{OrgRole: org.RoleEditor},
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
				Err: errors.New(`unrecognized MSSQL URL format: "localhost\\instance::1433"`),
				URL: `localhost\instance::1433`,
			},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.description, func(t *testing.T) {
			ds := datasources.DataSource{
				Type: "mssql",
				URL:  tc.url,
			}

			var routes []*plugins.Route
			p, err := setupDSProxyTest(t, &ctx, &ds, routes, "api/method")
			if tc.err == nil {
				require.NoError(t, err)
				assert.Equal(t, &url.URL{
					Scheme: "sqlserver",
					Host:   ds.URL,
				}, p.targetUrl)
			} else {
				require.Error(t, err)
				assert.Equal(t, tc.err, err)
			}
		})
	}
}

// getDatasourceProxiedRequest is a helper for easier setup of tests based on global config and ReqContext.
func getDatasourceProxiedRequest(t *testing.T, ctx *contextmodel.ReqContext, cfg *setting.Cfg) *http.Request {
	ds := &datasources.DataSource{
		Type: "custom",
		URL:  "http://host/root/",
	}
	tracer := tracing.InitializeTracerForTest()

	var routes []*plugins.Route
	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	features := featuremgmt.WithFeatures()
	quotaService := quotatest.New(false, nil)
	dsService, err := datasourceservice.ProvideService(nil, secretsService, secretsStore, cfg, features, acimpl.ProvideAccessControl(features),
		&actest.FakePermissionsService{}, quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{},
		plugincontext.ProvideBaseService(cfg, pluginconfig.NewFakePluginRequestConfigProvider()))
	require.NoError(t, err)
	proxy, err := NewDataSourceProxy(ds, routes, ctx, "", cfg, httpclient.NewProvider(), &oauthtoken.Service{}, dsService, tracer, features)
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
		Body: io.NopCloser(bytes.NewReader(body)),
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
	datasource *datasources.DataSource
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

func createAuthTest(t *testing.T, secretsStore secretskvs.SecretsKVStore, dsType string, url string, authType string, authCheck string) *testCase {
	// Basic user:password
	base64AuthHeader := "Basic dXNlcjpwYXNzd29yZA=="

	test := &testCase{
		datasource: &datasources.DataSource{
			ID:       1,
			OrgID:    1,
			Name:     fmt.Sprintf("%s,%s,%s,%s", dsType, url, authType, authCheck),
			Type:     dsType,
			JsonData: simplejson.New(),
			URL:      url,
		},
	}
	var message string
	var err error
	if authType == authTypePassword {
		message = fmt.Sprintf("%v should add username and password", dsType)
		test.datasource.User = "user"
		secureJsonData, err := json.Marshal(map[string]string{
			"password": "password",
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), test.datasource.OrgID, test.datasource.Name, "datasource", string(secureJsonData))
		require.NoError(t, err)
	} else {
		message = fmt.Sprintf("%v should add basic auth username and password", dsType)
		test.datasource.BasicAuth = true
		test.datasource.BasicAuthUser = "user"
		secureJsonData, err := json.Marshal(map[string]string{
			"basicAuthPassword": "password",
		})
		require.NoError(t, err)

		err = secretsStore.Set(context.Background(), test.datasource.OrgID, test.datasource.Name, "datasource", string(secureJsonData))
		require.NoError(t, err)
	}
	require.NoError(t, err)

	message += " from securejsondata"

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

func runDatasourceAuthTest(t *testing.T, secretsService secrets.Service, secretsStore secretskvs.SecretsKVStore, cfg *setting.Cfg, test *testCase) {
	ctx := &contextmodel.ReqContext{}
	tracer := tracing.InitializeTracerForTest()

	var routes []*plugins.Route
	features := featuremgmt.WithFeatures()
	quotaService := quotatest.New(false, nil)
	dsService, err := datasourceservice.ProvideService(nil, secretsService, secretsStore, cfg, features, acimpl.ProvideAccessControl(features),
		&actest.FakePermissionsService{}, quotaService, &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{},
		plugincontext.ProvideBaseService(cfg, pluginconfig.NewFakePluginRequestConfigProvider()))
	require.NoError(t, err)
	proxy, err := NewDataSourceProxy(test.datasource, routes, ctx, "", &setting.Cfg{}, httpclient.NewProvider(), &oauthtoken.Service{}, dsService, tracer, features)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodGet, "http://grafana.com/sub", nil)
	require.NoError(t, err)

	proxy.director(req)

	test.checkReq(req)
}

func Test_PathCheck(t *testing.T) {
	// Ensure that we test routes appropriately. This test reproduces a historical bug where two routes were defined with different role requirements but the same method and the more privileged route was tested first. Here we ensure auth checks are applied based on the correct route, not just the method.
	routes := []*plugins.Route{
		{
			Path:    "a",
			URL:     "https://www.google.com",
			ReqRole: org.RoleEditor,
			Method:  http.MethodGet,
		},
		{
			Path:    "b",
			URL:     "https://www.google.com",
			ReqRole: org.RoleViewer,
			Method:  http.MethodGet,
		},
	}

	setUp := func() (*contextmodel.ReqContext, *http.Request) {
		req, err := http.NewRequest("GET", "http://localhost/asd", nil)
		require.NoError(t, err)
		ctx := &contextmodel.ReqContext{
			Context:      &web.Context{Req: req},
			SignedInUser: &user.SignedInUser{OrgRole: org.RoleViewer},
		}
		return ctx, req
	}
	ctx, _ := setUp()
	proxy, err := setupDSProxyTest(t, ctx, &datasources.DataSource{}, routes, "b")
	require.NoError(t, err)

	require.Nil(t, proxy.validateRequest())
	require.Equal(t, routes[1], proxy.matchedRoute)
}

func setupDSProxyTest(t *testing.T, ctx *contextmodel.ReqContext, ds *datasources.DataSource, routes []*plugins.Route, path string, opts ...func(proxy *DataSourceProxy)) (*DataSourceProxy, error) {
	t.Helper()

	cfg := setting.NewCfg()
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(dbtest.NewFakeDB(), secretsService, log.NewNopLogger())
	features := featuremgmt.WithFeatures()
	dsService, err := datasourceservice.ProvideService(nil, secretsService, secretsStore, cfg, features, acimpl.ProvideAccessControl(features),
		&actest.FakePermissionsService{}, quotatest.New(false, nil), &pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{},
		plugincontext.ProvideBaseService(cfg, pluginconfig.NewFakePluginRequestConfigProvider()))
	require.NoError(t, err)

	tracer := tracing.InitializeTracerForTest()

	proxy, err := NewDataSourceProxy(ds, routes, ctx, path, cfg, httpclient.NewProvider(), &oauthtoken.Service{}, dsService, tracer, features)
	if err != nil {
		return nil, err
	}

	for _, o := range opts {
		o(proxy)
	}

	return proxy, nil
}
