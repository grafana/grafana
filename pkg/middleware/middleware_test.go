package middleware

import (
	"context"
	"errors"
	"fmt"
	"net"
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
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/login"
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
	origErrTemplateName := setting.ErrTemplateName
	t.Cleanup(func() {
		setting.ErrTemplateName = origErrTemplateName
	})
	setting.ErrTemplateName = errorTemplate

	middlewareScenario(t, "middleware should get correct x-xss-protection header", func(sc *scenarioContext) {
		origXSSProtectionHeader := setting.XSSProtectionHeader
		t.Cleanup(func() {
			setting.XSSProtectionHeader = origXSSProtectionHeader
		})
		setting.XSSProtectionHeader = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "1; mode=block", sc.resp.Header().Get("X-XSS-Protection"))
	})

	middlewareScenario(t, "middleware should not get x-xss-protection when disabled", func(sc *scenarioContext) {
		origXSSProtectionHeader := setting.XSSProtectionHeader
		t.Cleanup(func() {
			setting.XSSProtectionHeader = origXSSProtectionHeader
		})
		setting.XSSProtectionHeader = false
		sc.fakeReq("GET", "/api/").exec()
		assert.Empty(t, sc.resp.Header().Get("X-XSS-Protection"))
	})

	middlewareScenario(t, "middleware should add correct Strict-Transport-Security header", func(sc *scenarioContext) {
		origStrictTransportSecurity := setting.StrictTransportSecurity
		origProtocol := setting.Protocol
		origStrictTransportSecurityMaxAge := setting.StrictTransportSecurityMaxAge
		t.Cleanup(func() {
			setting.StrictTransportSecurity = origStrictTransportSecurity
			setting.Protocol = origProtocol
			setting.StrictTransportSecurityMaxAge = origStrictTransportSecurityMaxAge
		})
		setting.StrictTransportSecurity = true
		setting.Protocol = setting.HTTPSScheme
		setting.StrictTransportSecurityMaxAge = 64000

		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000", sc.resp.Header().Get("Strict-Transport-Security"))
		setting.StrictTransportSecurityPreload = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000; preload", sc.resp.Header().Get("Strict-Transport-Security"))
		setting.StrictTransportSecuritySubDomains = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000; preload; includeSubDomains", sc.resp.Header().Get("Strict-Transport-Security"))
	})
}

func TestMiddlewareContext(t *testing.T) {
	origErrTemplateName := setting.ErrTemplateName
	t.Cleanup(func() {
		setting.ErrTemplateName = origErrTemplateName
	})
	setting.ErrTemplateName = errorTemplate

	middlewareScenario(t, "middleware should add context to injector", func(sc *scenarioContext) {
		sc.fakeReq("GET", "/").exec()
		assert.NotNil(t, sc.context)
	})

	middlewareScenario(t, "Default middleware should allow get request", func(sc *scenarioContext) {
		sc.fakeReq("GET", "/").exec()
		assert.Equal(t, 200, sc.resp.Code)
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests to API", func(sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Equal(t, "no-cache", sc.resp.Header().Get("Cache-Control"))
		assert.Equal(t, "no-cache", sc.resp.Header().Get("Pragma"))
		assert.Equal(t, "-1", sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should not add Cache-Control header for requests to datasource proxy API", func(sc *scenarioContext) {
		sc.fakeReq("GET", "/api/datasources/proxy/1/test").exec()
		assert.Empty(t, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests with html response", func(sc *scenarioContext) {
		sc.handler(func(c *models.ReqContext) {
			data := &dtos.IndexViewData{
				User:     &dtos.CurrentUser{},
				Settings: map[string]interface{}{},
				NavTree:  []*dtos.NavLink{},
			}
			c.HTML(200, "index-template", data)
		})
		sc.fakeReq("GET", "/").exec()
		assert.Equal(t, 200, sc.resp.Code)
		assert.Equal(t, "no-cache", sc.resp.Header().Get("Cache-Control"))
		assert.Equal(t, "no-cache", sc.resp.Header().Get("Pragma"))
		assert.Equal(t, "-1", sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add X-Frame-Options header with deny for request when not allowing embedding", func(sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Equal(t, "deny", sc.resp.Header().Get("X-Frame-Options"))
	})

	middlewareScenario(t, "middleware should not add X-Frame-Options header for request when allowing embedding", func(sc *scenarioContext) {
		origAllowEmbedding := setting.AllowEmbedding
		t.Cleanup(func() {
			setting.AllowEmbedding = origAllowEmbedding
		})
		setting.AllowEmbedding = true
		sc.fakeReq("GET", "/api/search").exec()
		assert.Empty(t, sc.resp.Header().Get("X-Frame-Options"))
	})

	middlewareScenario(t, "Invalid api key", func(sc *scenarioContext) {
		sc.apiKey = "invalid_key_test"
		sc.fakeReq("GET", "/").exec()

		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, errStringInvalidAPIKey, sc.respJson["message"])
	})

	middlewareScenario(t, "Valid api key", func(sc *scenarioContext) {
		const orgID int64 = 12
		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: orgID, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		assert.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
	})

	middlewareScenario(t, "Valid api key, but does not match db hash", func(sc *scenarioContext) {
		keyhash := "Something_not_matching"

		bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
			query.Result = &models.ApiKey{OrgId: 12, Role: models.ROLE_EDITOR, Key: keyhash}
			return nil
		})

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, errStringInvalidAPIKey, sc.respJson["message"])
	})

	middlewareScenario(t, "Valid api key, but expired", func(sc *scenarioContext) {
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

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, "Expired API key", sc.respJson["message"])
	})

	middlewareScenario(t, "Non-expired auth token in cookie which not are being rotated", func(sc *scenarioContext) {
		const userID int64 = 12

		sc.withTokenSessionCookie("token")

		bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{OrgId: 2, UserId: userID}
			return nil
		})

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        userID,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq("GET", "/").exec()

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, userID, sc.context.UserId)
		assert.Equal(t, userID, sc.context.UserToken.UserId)
		assert.Equal(t, "token", sc.context.UserToken.UnhashedToken)
		assert.Equal(t, "", sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "Non-expired auth token in cookie which are being rotated", func(sc *scenarioContext) {
		const userID int64 = 12

		sc.withTokenSessionCookie("token")

		bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
			query.Result = &models.SignedInUser{OrgId: 2, UserId: userID}
			return nil
		})

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        userID,
				UnhashedToken: "",
			}, nil
		}

		sc.userAuthTokenService.TryRotateTokenProvider = func(ctx context.Context, userToken *models.UserToken,
			clientIP net.IP, userAgent string) (bool, error) {
			userToken.UnhashedToken = "rotated"
			return true, nil
		}

		maxAge := int(setting.LoginMaxLifetime.Seconds())

		sameSiteModes := []http.SameSite{
			http.SameSiteNoneMode,
			http.SameSiteLaxMode,
			http.SameSiteStrictMode,
		}
		for _, sameSiteMode := range sameSiteModes {
			t.Run(fmt.Sprintf("Same site mode %d", sameSiteMode), func(t *testing.T) {
				origCookieSameSiteMode := setting.CookieSameSiteMode
				t.Cleanup(func() {
					setting.CookieSameSiteMode = origCookieSameSiteMode
				})
				setting.CookieSameSiteMode = sameSiteMode

				expectedCookiePath := "/"
				if len(setting.AppSubUrl) > 0 {
					expectedCookiePath = setting.AppSubUrl
				}
				expectedCookie := &http.Cookie{
					Name:     setting.LoginCookieName,
					Value:    "rotated",
					Path:     expectedCookiePath,
					HttpOnly: true,
					MaxAge:   maxAge,
					Secure:   setting.CookieSecure,
					SameSite: sameSiteMode,
				}

				sc.fakeReq("GET", "/").exec()

				assert.True(t, sc.context.IsSignedIn)
				assert.Equal(t, userID, sc.context.UserId)
				assert.Equal(t, userID, sc.context.UserToken.UserId)
				assert.Equal(t, "rotated", sc.context.UserToken.UnhashedToken)
				assert.Equal(t, expectedCookie.String(), sc.resp.Header().Get("Set-Cookie"))
			})
		}

		t.Run("Should not set cookie with SameSite attribute when setting.CookieSameSiteDisabled is true", func(t *testing.T) {
			origCookieSameSiteDisabled := setting.CookieSameSiteDisabled
			origCookieSameSiteMode := setting.CookieSameSiteMode
			t.Cleanup(func() {
				setting.CookieSameSiteDisabled = origCookieSameSiteDisabled
				setting.CookieSameSiteMode = origCookieSameSiteMode
			})
			setting.CookieSameSiteDisabled = true
			setting.CookieSameSiteMode = http.SameSiteLaxMode

			expectedCookiePath := "/"
			if len(setting.AppSubUrl) > 0 {
				expectedCookiePath = setting.AppSubUrl
			}
			expectedCookie := &http.Cookie{
				Name:     setting.LoginCookieName,
				Value:    "rotated",
				Path:     expectedCookiePath,
				HttpOnly: true,
				MaxAge:   maxAge,
				Secure:   setting.CookieSecure,
			}

			sc.fakeReq("GET", "/").exec()
			assert.Equal(t, expectedCookie.String(), sc.resp.Header().Get("Set-Cookie"))
		})
	})

	middlewareScenario(t, "Invalid/expired auth token in cookie", func(sc *scenarioContext) {
		sc.withTokenSessionCookie("token")

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return nil, models.ErrUserTokenNotFound
		}

		sc.fakeReq("GET", "/").exec()

		assert.False(t, sc.context.IsSignedIn)
		assert.Equal(t, int64(0), sc.context.UserId)
		assert.Nil(t, sc.context.UserToken)
	})

	middlewareScenario(t, "When anonymous access is enabled", func(sc *scenarioContext) {
		const orgID int64 = 2

		origAnonymousEnabled := setting.AnonymousEnabled
		origAnonymousOrgName := setting.AnonymousOrgName
		origAnonymousOrgRole := setting.AnonymousOrgRole
		t.Cleanup(func() {
			setting.AnonymousEnabled = origAnonymousEnabled
			setting.AnonymousOrgName = origAnonymousOrgName
			setting.AnonymousOrgRole = origAnonymousOrgRole
		})
		setting.AnonymousEnabled = true
		setting.AnonymousOrgName = "test"
		setting.AnonymousOrgRole = string(models.ROLE_EDITOR)

		bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
			assert.Equal(t, "test", query.Name)

			query.Result = &models.Org{Id: orgID, Name: "test"}
			return nil
		})

		sc.fakeReq("GET", "/").exec()

		assert.Equal(t, int64(0), sc.context.UserId)
		assert.Equal(t, orgID, sc.context.OrgId)
		assert.Equal(t, models.ROLE_EDITOR, sc.context.OrgRole)
		assert.False(t, sc.context.IsSignedIn)
	})

	t.Run("auth_proxy", func(t *testing.T) {
		const userID int64 = 33
		const orgID int64 = 4

		origAuthProxyEnabled := setting.AuthProxyEnabled
		origAuthProxyWhitelist := setting.AuthProxyWhitelist
		origAuthProxyAutoSignUp := setting.AuthProxyAutoSignUp
		origLDAPEnabled := setting.LDAPEnabled
		origAuthProxyHeaderName := setting.AuthProxyHeaderName
		origAuthProxyHeaderProperty := setting.AuthProxyHeaderProperty
		origAuthProxyHeaders := setting.AuthProxyHeaders
		t.Cleanup(func() {
			setting.AuthProxyEnabled = origAuthProxyEnabled
			setting.AuthProxyWhitelist = origAuthProxyWhitelist
			setting.AuthProxyAutoSignUp = origAuthProxyAutoSignUp
			setting.LDAPEnabled = origLDAPEnabled
			setting.AuthProxyHeaderName = origAuthProxyHeaderName
			setting.AuthProxyHeaderProperty = origAuthProxyHeaderProperty
			setting.AuthProxyHeaders = origAuthProxyHeaders
		})
		setting.AuthProxyEnabled = true
		setting.AuthProxyWhitelist = ""
		setting.AuthProxyAutoSignUp = true
		setting.LDAPEnabled = true
		setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
		setting.AuthProxyHeaderProperty = "username"
		setting.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS"}

		const hdrName = "markelog"
		const group = "grafana-core-team"

		middlewareScenario(t, "Should not sync the user if it's in the cache", func(sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: orgID, UserId: query.UserId}
				return nil
			})

			key := fmt.Sprintf(authproxy.CachePrefix, authproxy.HashCacheKey(hdrName+"-"+group))
			err := sc.remoteCacheService.Set(key, userID, 0)
			require.NoError(t, err)
			sc.fakeReq("GET", "/")

			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.req.Header.Set("X-WEBAUTH-GROUPS", group)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserId)
			assert.Equal(t, orgID, sc.context.OrgId)
		})

		middlewareScenario(t, "Should respect auto signup option", func(sc *scenarioContext) {
			origLDAPEnabled = setting.LDAPEnabled
			origAuthProxyAutoSignUp = setting.AuthProxyAutoSignUp
			t.Cleanup(func() {
				setting.LDAPEnabled = origLDAPEnabled
				setting.AuthProxyAutoSignUp = origAuthProxyAutoSignUp
			})
			setting.LDAPEnabled = false
			setting.AuthProxyAutoSignUp = false

			var actualAuthProxyAutoSignUp *bool = nil

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				actualAuthProxyAutoSignUp = &cmd.SignupAllowed
				return login.ErrInvalidCredentials
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.False(t, *actualAuthProxyAutoSignUp)
			assert.Equal(t, sc.resp.Code, 407)
			assert.Nil(t, sc.context)
		})

		middlewareScenario(t, "Should create an user from a header", func(sc *scenarioContext) {
			origLDAPEnabled = setting.LDAPEnabled
			origAuthProxyAutoSignUp = setting.AuthProxyAutoSignUp
			t.Cleanup(func() {
				setting.LDAPEnabled = origLDAPEnabled
				setting.AuthProxyAutoSignUp = origAuthProxyAutoSignUp
			})
			setting.LDAPEnabled = false
			setting.AuthProxyAutoSignUp = true

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				if query.UserId > 0 {
					query.Result = &models.SignedInUser{OrgId: orgID, UserId: userID}
					return nil
				}
				return models.ErrUserNotFound
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: userID}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserId)
			assert.Equal(t, orgID, sc.context.OrgId)
		})

		middlewareScenario(t, "Should get an existing user from header", func(sc *scenarioContext) {
			const userID int64 = 12
			const orgID int64 = 2

			origLDAPEnabled = setting.LDAPEnabled
			t.Cleanup(func() {
				setting.LDAPEnabled = origLDAPEnabled
			})
			setting.LDAPEnabled = false

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: orgID, UserId: userID}
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: userID}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserId)
			assert.Equal(t, orgID, sc.context.OrgId)
		})

		middlewareScenario(t, "Should allow the request from whitelist IP", func(sc *scenarioContext) {
			origAuthProxyWhitelist = setting.AuthProxyWhitelist
			origLDAPEnabled = setting.LDAPEnabled
			t.Cleanup(func() {
				setting.AuthProxyWhitelist = origAuthProxyWhitelist
				setting.LDAPEnabled = origLDAPEnabled
			})
			setting.AuthProxyWhitelist = "192.168.1.0/24, 2001::0/120"
			setting.LDAPEnabled = false

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: orgID, UserId: userID}
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: userID}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserId)
			assert.Equal(t, orgID, sc.context.OrgId)
		})

		middlewareScenario(t, "Should not allow the request from whitelist IP", func(sc *scenarioContext) {
			origAuthProxyWhitelist = setting.AuthProxyWhitelist
			origLDAPEnabled = setting.LDAPEnabled
			t.Cleanup(func() {
				setting.AuthProxyWhitelist = origAuthProxyWhitelist
				setting.LDAPEnabled = origLDAPEnabled
			})
			setting.AuthProxyWhitelist = "8.8.8.8"
			setting.LDAPEnabled = false

			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: orgID, UserId: userID}
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				cmd.Result = &models.User{Id: userID}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec()

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		})

		middlewareScenario(t, "Should return 407 status code if LDAP says no", func(sc *scenarioContext) {
			bus.AddHandler("LDAP", func(cmd *models.UpsertUserCommand) error {
				return errors.New("Do not add user")
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		})

		middlewareScenario(t, "Should return 407 status code if there is cache mishap", func(sc *scenarioContext) {
			bus.AddHandler("Do not have the user", func(query *models.GetSignedInUserQuery) error {
				return errors.New("Do not add user")
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(setting.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		})
	})
}

func middlewareScenario(t *testing.T, desc string, fn scenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		origLoginCookieName := setting.LoginCookieName
		origLoginMaxLifetime := setting.LoginMaxLifetime
		t.Cleanup(func() {
			setting.LoginCookieName = origLoginCookieName
			setting.LoginMaxLifetime = origLoginMaxLifetime
		})
		setting.LoginCookieName = "grafana_session"
		var err error
		setting.LoginMaxLifetime, err = gtime.ParseDuration("30d")
		require.NoError(t, err)

		sc := &scenarioContext{t: t}

		viewsPath, err := filepath.Abs("../../public/views")
		require.NoError(t, err)

		sc.m = macaron.New()
		sc.m.Use(AddDefaultResponseHeaders())
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.userAuthTokenService = auth.NewFakeUserAuthTokenService()
		sc.remoteCacheService = remotecache.NewFakeStore(t)

		sc.m.Use(GetContextHandler(sc.userAuthTokenService, sc.remoteCacheService, nil))

		sc.m.Use(OrgRedirect())

		sc.defaultHandler = func(c *models.ReqContext) {
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
			} else {
				resp := make(map[string]interface{})
				resp["message"] = "OK"
				c.JSON(200, resp)
			}
		}

		sc.m.Get("/", sc.defaultHandler)

		fn(sc)
	})
}

func TestDontRotateTokensOnCancelledRequests(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	reqContext, _, err := initTokenRotationTest(ctx, t)
	require.NoError(t, err)

	tryRotateCallCount := 0
	uts := &auth.FakeUserAuthTokenService{
		TryRotateTokenProvider: func(ctx context.Context, token *models.UserToken, clientIP net.IP,
			userAgent string) (bool, error) {
			tryRotateCallCount++
			return false, nil
		},
	}

	token := &models.UserToken{AuthToken: "oldtoken"}

	fn := rotateEndOfRequestFunc(reqContext, uts, token)
	cancel()
	fn(reqContext.Resp)

	assert.Equal(t, 0, tryRotateCallCount, "Token rotation was attempted")
}

func TestTokenRotationAtEndOfRequest(t *testing.T) {
	reqContext, rr, err := initTokenRotationTest(context.Background(), t)
	require.NoError(t, err)

	uts := &auth.FakeUserAuthTokenService{
		TryRotateTokenProvider: func(ctx context.Context, token *models.UserToken, clientIP net.IP,
			userAgent string) (bool, error) {
			newToken, err := util.RandomHex(16)
			require.NoError(t, err)
			token.AuthToken = newToken
			return true, nil
		},
	}

	token := &models.UserToken{AuthToken: "oldtoken"}

	rotateEndOfRequestFunc(reqContext, uts, token)(reqContext.Resp)

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
}

func initTokenRotationTest(ctx context.Context, t *testing.T) (*models.ReqContext, *httptest.ResponseRecorder, error) {
	t.Helper()

	origLoginCookieName := setting.LoginCookieName
	origLoginMaxLifetime := setting.LoginMaxLifetime
	t.Cleanup(func() {
		setting.LoginCookieName = origLoginCookieName
		setting.LoginMaxLifetime = origLoginMaxLifetime
	})
	setting.LoginCookieName = "login_token"
	var err error
	setting.LoginMaxLifetime, err = gtime.ParseDuration("7d")
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
