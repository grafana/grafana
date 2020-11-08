package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/gtime"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/middleware/authproxy"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const errorTemplate = "error-template"

func mockGetTime() {
	var timeSeed int64
	getTime = func() time.Time {
		fakeNow := time.Unix(timeSeed, 0)
		timeSeed++
		return fakeNow
	}
}

func resetGetTime() {
	getTime = time.Now
}

func TestMiddleWareSecurityHeaders(t *testing.T) {
	middlewareScenario(t, "middleware should get correct x-xss-protection header", func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.ErrTemplateName = errorTemplate
		sc.service.Cfg.XSSProtectionHeader = true
		sc.fakeReq(t, "GET", "/api/").exec(t)
		assert.Equal(t, "1; mode=block", sc.resp.Header().Get("X-XSS-Protection"))
	})

	middlewareScenario(t, "middleware should not get x-xss-protection when disabled", func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.ErrTemplateName = errorTemplate
		sc.service.Cfg.XSSProtectionHeader = false
		sc.fakeReq(t, "GET", "/api/").exec(t)
		assert.Empty(t, sc.resp.Header().Get("X-XSS-Protection"))
	})

	middlewareScenario(t, "middleware should add correct Strict-Transport-Security header", func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.ErrTemplateName = errorTemplate
		sc.service.Cfg.StrictTransportSecurity = true
		sc.service.Cfg.Protocol = setting.HTTPSScheme

		sc.service.Cfg.StrictTransportSecurityMaxAge = 64000
		sc.fakeReq(t, "GET", "/api/").exec(t)
		assert.Equal(t, "max-age=64000", sc.resp.Header().Get("Strict-Transport-Security"))
		sc.service.Cfg.StrictTransportSecurityPreload = true
		sc.fakeReq(t, "GET", "/api/").exec(t)
		assert.Equal(t, "max-age=64000; preload", sc.resp.Header().Get("Strict-Transport-Security"))
		sc.service.Cfg.StrictTransportSecuritySubDomains = true
		sc.fakeReq(t, "GET", "/api/").exec(t)
		assert.Equal(t, "max-age=64000; preload; includeSubDomains", sc.resp.Header().Get("Strict-Transport-Security"))
	})
}

func TestMiddlewareContext(t *testing.T) {
	const noCache = "no-cache"
	//sc.service.Cfg.ErrTemplateName = errorTemplate
	middlewareScenario(t, "middleware should add context to injector", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq(t, "GET", "/").exec(t)
		assert.NotNil(t, sc.context)
	})

	middlewareScenario(t, "Default middleware should allow get request", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq(t, "GET", "/").exec(t)
		assert.Equal(t, 200, sc.resp.Code)
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests to API", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq(t, "GET", "/api/search").exec(t)
		assert.Equal(t, noCache, sc.resp.Header().Get("Cache-Control"))
		assert.Equal(t, noCache, sc.resp.Header().Get("Pragma"))
		assert.Equal(t, "-1", sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should not add Cache-Control header for requests to datasource proxy API", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq(t, "GET", "/api/datasources/proxy/1/test").exec(t)
		assert.Empty(t, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests with html response", func(t *testing.T, sc *scenarioContext) {
		sc.handler(func(c *models.ReqContext) {
			data := &dtos.IndexViewData{
				User:     &dtos.CurrentUser{},
				Settings: map[string]interface{}{},
				NavTree:  []*dtos.NavLink{},
			}
			c.HTML(200, "index-template", data)
		})
		sc.fakeReq(t, "GET", "/").exec(t)
		assert.Equal(t, 200, sc.resp.Code)
		assert.Equal(t, noCache, sc.resp.Header().Get("Cache-Control"))
		assert.Equal(t, noCache, sc.resp.Header().Get("Pragma"))
		assert.Equal(t, -1, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add X-Frame-Options header with deny for request when not allowing embedding", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq(t, "GET", "/api/search").exec(t)
		assert.Equal(t, "deny", sc.resp.Header().Get("X-Frame-Options"))
	})

	middlewareScenario(t, "middleware should not add X-Frame-Options header for request when allowing embedding",
		func(t *testing.T, sc *scenarioContext) {
			sc.service.Cfg.AllowEmbedding = true
			sc.fakeReq(t, "GET", "/api/search").exec(t)
			assert.Empty(t, sc.resp.Header().Get("X-Frame-Options"))
		})

	middlewareScenario(t, "Invalid API key", func(t *testing.T, sc *scenarioContext) {
		sc.apiKey = "invalid_key_test"
		sc.fakeReq(t, "GET", "/").exec(t)

		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, errStringInvalidAPIKey, sc.respJson["message"])
	})

	middlewareScenario(t, "Valid API key", func(t *testing.T, sc *scenarioContext) {
		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: 12, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		sc.fakeReq(t, "GET", "/").withValidApiKey().exec(t)

		require.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, 12, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
	})

	middlewareScenario(t, "Valid API key, but does not match DB hash", func(t *testing.T, sc *scenarioContext) {
		const keyhash = "Something_not_matching"

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: 12, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		sc.fakeReq(t, "GET", "/").withValidApiKey().exec(t)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, errStringInvalidAPIKey, sc.respJson["message"])
	})

	middlewareScenario(t, "Valid API key, but expired", func(t *testing.T, sc *scenarioContext) {
		mockGetTime()
		defer resetGetTime()

		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			// api key expired one second before
			expires := getTime().Add(-1 * time.Second).Unix()
			query.Result = &models.ApiKey{OrgId: 12, Role: models.ROLE_EDITOR, Key: keyhash,
				Expires: &expires}
			return nil
		})

		sc.fakeReq(t, "GET", "/").withValidApiKey().exec(t)

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, "Expired API key", sc.respJson["message"])
	})

	middlewareScenario(t, "Non-expired auth token in cookie which not are being rotated", func(t *testing.T, sc *scenarioContext) {
		sc.withTokenSessionCookie("token")

		bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{OrgId: 2, UserId: 12}
			return nil
		})

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        12,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq(t, "GET", "/").exec(t)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, 12, sc.context.UserId)
		assert.Equal(t, 12, sc.context.UserToken.UserId)
		assert.Equal(t, "token", sc.context.UserToken.UnhashedToken)
		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "Non-expired auth token in cookie which are being rotated", func(t *testing.T, sc *scenarioContext) {
		sc.withTokenSessionCookie("token")

		bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{OrgId: 2, UserId: 12}
			return nil
		})

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        12,
				UnhashedToken: "",
			}, nil
		}

		sc.userAuthTokenService.TryRotateTokenProvider = func(ctx context.Context, userToken *models.UserToken, clientIP, userAgent string) (bool, error) {
			userToken.UnhashedToken = "rotated"
			return true, nil
		}

		maxAge := int(sc.service.Cfg.LoginMaxLifetime.Seconds())

		sameSitePolicies := []http.SameSite{
			http.SameSiteNoneMode,
			http.SameSiteLaxMode,
			http.SameSiteStrictMode,
		}
		for _, sameSitePolicy := range sameSitePolicies {
			sc.service.Cfg.CookieSameSiteMode = sameSitePolicy
			expectedCookiePath := "/"
			if len(sc.service.Cfg.AppSubURL) > 0 {
				expectedCookiePath = sc.service.Cfg.AppSubURL
			}
			expectedCookie := &http.Cookie{
				Name:     sc.service.Cfg.LoginCookieName,
				Value:    "rotated",
				Path:     expectedCookiePath,
				HttpOnly: true,
				MaxAge:   maxAge,
				Secure:   sc.service.Cfg.CookieSecure,
				SameSite: sameSitePolicy,
			}

			sc.fakeReq(t, "GET", "/").exec(t)

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, 12, sc.context.UserId)
			assert.Equal(t, 12, sc.context.UserToken.UserId)
			assert.Equal(t, "rotated", sc.context.UserToken.UnhashedToken)
			assert.Equal(t, expectedCookie.String(), sc.resp.Header().Get("Set-Cookie"))
		}

		t.Run("Should not set cookie with SameSite attribute when setting.CookieSameSiteDisabled is true", func(t *testing.T) {
			sc.service.Cfg.CookieSameSiteDisabled = true
			sc.service.Cfg.CookieSameSiteMode = http.SameSiteLaxMode
			expectedCookiePath := "/"
			if len(sc.service.Cfg.AppSubURL) > 0 {
				expectedCookiePath = sc.service.Cfg.AppSubURL
			}
			expectedCookie := &http.Cookie{
				Name:     sc.service.Cfg.LoginCookieName,
				Value:    "rotated",
				Path:     expectedCookiePath,
				HttpOnly: true,
				MaxAge:   maxAge,
				Secure:   sc.service.Cfg.CookieSecure,
			}

			sc.fakeReq(t, "GET", "/").exec(t)
			assert.Equal(t, expectedCookie.String(), sc.resp.Header().Get("Set-Cookie"))
		})
	})

	middlewareScenario(t, "Invalid/expired auth token in cookie", func(t *testing.T, sc *scenarioContext) {
		sc.withTokenSessionCookie("token")

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return nil, models.ErrUserTokenNotFound
		}

		sc.fakeReq(t, "GET", "/").exec(t)

		assert.False(t, sc.context.IsSignedIn)
		assert.Equal(t, 0, sc.context.UserId)
		assert.Nil(t, sc.context.UserToken)
	})

	middlewareScenario(t, "When anonymous access is enabled", func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.AnonymousEnabled = true
		sc.service.Cfg.AnonymousOrgName = "test"
		sc.service.Cfg.AnonymousOrgRole = string(models.ROLE_EDITOR)

		bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
			assert.Equal(t, "test", query.Name)

			query.Result = &models.Org{Id: 2, Name: "test"}
			return nil
		})

		sc.fakeReq(t, "GET", "/").exec(t)

		assert.Equal(t, 0, sc.context.UserId)
		assert.Equal(t, 2, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
		assert.False(t, sc.context.IsSignedIn)
	})

	middlewareScenario(t, "auth_proxy", func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.AuthProxyEnabled = true
		sc.service.Cfg.AuthProxyWhitelist = ""
		sc.service.Cfg.AuthProxyAutoSignUp = true
		sc.service.Cfg.LDAPEnabled = true
		sc.service.Cfg.AuthProxyHeaderName = "X-WEBAUTH-USER"
		sc.service.Cfg.AuthProxyHeaderProperty = "username"
		sc.service.Cfg.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS"}
		name := "markelog"
		group := "grafana-core-team"

		middlewareScenario(t, "Should not sync the user if it's in the cache", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: 4, UserId: query.UserId}
				return nil
			})

			key := fmt.Sprintf(authproxy.CachePrefix, authproxy.HashCacheKey(name+"-"+group))
			err := sc.remoteCacheService.Set(key, int64(33), 0)
			require.NoError(t, err)
			sc.fakeReq(t, "GET", "/")

			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.req.Header.Add("X-WEBAUTH-GROUPS", group)
			sc.exec(t)

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, 33, sc.context.UserId)
			assert.Equal(t, 4, sc.context.OrgId)
		})

		middlewareScenario(t, "Should respect auto signup option", func(t *testing.T, sc *scenarioContext) {
			sc.service.Cfg.LDAPEnabled = false
			sc.service.Cfg.AuthProxyAutoSignUp = false
			var actualAuthProxyAutoSignUp *bool = nil

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				actualAuthProxyAutoSignUp = &cmd.SignupAllowed
				return login.ErrInvalidCredentials
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.exec(t)

			assert.False(t, *actualAuthProxyAutoSignUp)
			assert.Equal(t, sc.resp.Code, 407)
			assert.Nil(t, sc.context)
		})

		middlewareScenario(t, "Should create an user from a header", func(t *testing.T, sc *scenarioContext) {
			sc.service.Cfg.LDAPEnabled = false
			sc.service.Cfg.AuthProxyAutoSignUp = true

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				if query.UserId > 0 {
					query.Result = &models.SignedInUser{OrgId: 4, UserId: 33}
					return nil
				}
				return models.ErrUserNotFound
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: 33}
				return nil
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.exec(t)

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, 33, sc.context.UserId)
			assert.Equal(t, 4, sc.context.OrgId)
		})

		middlewareScenario(t, "Should get an existing user from header", func(t *testing.T, sc *scenarioContext) {
			sc.service.Cfg.LDAPEnabled = false

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: 12}
				return nil
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.exec(t)

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, 12, sc.context.UserId)
			assert.Equal(t, 2, sc.context.OrgId)
		})

		middlewareScenario(t, "Should allow the request from whitelist IP", func(t *testing.T, sc *scenarioContext) {
			sc.service.Cfg.AuthProxyWhitelist = "192.168.1.0/24, 2001::0/120"
			sc.service.Cfg.LDAPEnabled = false

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: 4, UserId: 33}
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: 33}
				return nil
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec(t)

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, 33, sc.context.UserId)
			assert.Equal(t, 4, sc.context.OrgId)
		})

		middlewareScenario(t, "Should not allow the request from whitelist IP", func(t *testing.T, sc *scenarioContext) {
			sc.service.Cfg.AuthProxyWhitelist = "8.8.8.8"
			sc.service.Cfg.LDAPEnabled = false

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: 4, UserId: 33}
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: 33}
				return nil
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec(t)

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		})

		middlewareScenario(t, "Should return 407 status code if LDAP says no", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("LDAP", func(cmd *models.UpsertUserCommand) error {
				return errors.New("Do not add user")
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.exec(t)

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		})

		middlewareScenario(t, "Should return 407 status code if there is cache mishap", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("Do not have the user", func(query *models.GetSignedInUserQuery) error {
				return errors.New("Do not add user")
			})

			sc.fakeReq(t, "GET", "/")
			sc.req.Header.Add(sc.service.Cfg.AuthProxyHeaderName, name)
			sc.exec(t)

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		})
	})
}

type scenarioFunc func(t *testing.T, c *scenarioContext)

type fakeRenderService struct {
	rendering.Service
}

func (s *fakeRenderService) Init() error {
	return nil
}

func middlewareScenario(t *testing.T, desc string, fn scenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		var err error
		cfg.LoginMaxLifetime, err = gtime.ParseDuration("30d")
		cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{
			Name:    "database",
			ConnStr: "",
		}

		sqlStore := sqlstore.InitTestDB(t)
		remoteCacheSvc := &remotecache.RemoteCache{}
		userAuthTokenSvc := auth.NewFakeUserAuthTokenService()
		renderSvc := &fakeRenderService{}
		svc := &MiddlewareService{}
		err = registry.BuildServiceGraph([]interface{}{cfg}, []*registry.Descriptor{
			{
				Name:     sqlstore.ServiceName,
				Instance: sqlStore,
			},
			{
				Name:     remotecache.ServiceName,
				Instance: remoteCacheSvc,
			},
			{
				Name:     auth.ServiceName,
				Instance: userAuthTokenSvc,
			},
			{
				Name:     rendering.ServiceName,
				Instance: renderSvc,
			},
			{
				Name:     serviceName,
				Instance: svc,
			},
		})
		require.NoError(t, err)

		t.Cleanup(bus.ClearBusHandlers)

		sc := &scenarioContext{
			service:              svc,
			m:                    macaron.New(),
			userAuthTokenService: userAuthTokenSvc,
			remoteCacheService:   remoteCacheSvc,
		}

		viewsPath, err := filepath.Abs("../../public/views")
		require.NoError(t, err)

		sc.m.Use(svc.AddDefaultResponseHeaders)
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(sc.service.ContextHandler)

		sc.m.Use(sc.service.OrgRedirect)

		sc.defaultHandler = func(c *models.ReqContext) {
			t.Log("Default handler executing")
			sc.context = c
			if sc.handlerFunc != nil {
				t.Log("Calling handlerFunc")
				sc.handlerFunc(sc.context)
			} else {
				t.Log("Returning JSON OK")
				c.JsonOK("OK")
			}
		}

		sc.m.Get("/", sc.defaultHandler)

		fn(t, sc)
	})
}

func TestTokenRotationAtEndOfRequest(t *testing.T) {
	middlewareScenario(t, "Don't rotate tokens on cancelled requests", func(t *testing.T, sc *scenarioContext) {
		ctx, cancel := context.WithCancel(context.Background())
		reqContext, _, err := initTokenRotationTest(ctx, sc)
		require.NoError(t, err)

		tryRotateCallCount := 0
		sc.userAuthTokenService.TryRotateTokenProvider = func(ctx context.Context, token *models.UserToken, clientIP,
			userAgent string) (bool, error) {
			tryRotateCallCount++
			return false, nil
		}

		token := &models.UserToken{AuthToken: "oldtoken"}

		fn := sc.service.rotateEndOfRequestFunc(reqContext, token)
		cancel()
		fn(reqContext.Resp)

		assert.Equal(t, 0, tryRotateCallCount, "Token rotation was attempted")
	})

	middlewareScenario(t, "Token rotationAtEndOfRequest", func(t *testing.T, sc *scenarioContext) {
		reqContext, rr, err := initTokenRotationTest(context.Background(), sc)
		require.NoError(t, err)

		sc.userAuthTokenService.TryRotateTokenProvider = func(ctx context.Context, token *models.UserToken, clientIP,
			userAgent string) (bool, error) {
			newToken, err := util.RandomHex(16)
			require.NoError(t, err)
			token.AuthToken = newToken
			return true, nil
		}

		token := &models.UserToken{AuthToken: "oldtoken"}

		sc.service.rotateEndOfRequestFunc(reqContext, token)(reqContext.Resp)

		foundLoginCookie := false
		resp := rr.Result()
		defer resp.Body.Close()
		for _, c := range resp.Cookies() {
			if c.Name == "login_token" {
				foundLoginCookie = true

				require.NotEqual(t, token.AuthToken, c.Value, "Auth token is still the same")
			}
		}

		assert.True(t, foundLoginCookie, "Could not find cookie")
	})
}

func initTokenRotationTest(ctx context.Context, sc *scenarioContext) (*models.ReqContext, *httptest.ResponseRecorder, error) {
	sc.service.Cfg.LoginCookieName = "login_token"
	var err error
	sc.service.Cfg.LoginMaxLifetime, err = gtime.ParseDuration("7d")
	if err != nil {
		return nil, nil, err
	}

	rr := httptest.NewRecorder()
	req, err := http.NewRequestWithContext(ctx, "", "", nil)
	if err != nil {
		return nil, nil, err
	}
	reqContext := &models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{
				Request: req,
			},
		},
		Logger: log.New("testlogger"),
	}

	mw := mockWriter{rr}
	reqContext.Resp = mw

	return reqContext, rr, nil
}

type mockWriter struct {
	*httptest.ResponseRecorder
}

func (mw mockWriter) Flush()                    {}
func (mw mockWriter) Status() int               { return 0 }
func (mw mockWriter) Size() int                 { return 0 }
func (mw mockWriter) Written() bool             { return false }
func (mw mockWriter) Before(macaron.BeforeFunc) {}
func (mw mockWriter) Push(target string, opts *http.PushOptions) error {
	return nil
}
