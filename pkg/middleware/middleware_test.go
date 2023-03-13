package middleware

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/services/anonymous/anontest"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/apikey/apikeytest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/authproxy"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	loginsvc "github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func fakeGetTime() func() time.Time {
	var timeSeed int64
	return func() time.Time {
		fakeNow := time.Unix(timeSeed, 0)
		timeSeed++
		return fakeNow
	}
}

func TestMiddleWareSecurityHeaders(t *testing.T) {
	middlewareScenario(t, "middleware should get correct x-xss-protection header", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "1; mode=block", sc.resp.Header().Get("X-XSS-Protection"))
	}, func(cfg *setting.Cfg) {
		cfg.XSSProtectionHeader = true
	})

	middlewareScenario(t, "middleware should not get x-xss-protection when disabled", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Empty(t, sc.resp.Header().Get("X-XSS-Protection"))
	}, func(cfg *setting.Cfg) {
		cfg.XSSProtectionHeader = false
	})

	middlewareScenario(t, "middleware should add correct Strict-Transport-Security header", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000", sc.resp.Header().Get("Strict-Transport-Security"))
		sc.cfg.StrictTransportSecurityPreload = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000; preload", sc.resp.Header().Get("Strict-Transport-Security"))
		sc.cfg.StrictTransportSecuritySubDomains = true
		sc.fakeReq("GET", "/api/").exec()
		assert.Equal(t, "max-age=64000; preload; includeSubDomains", sc.resp.Header().Get("Strict-Transport-Security"))
	}, func(cfg *setting.Cfg) {
		cfg.StrictTransportSecurity = true
		cfg.StrictTransportSecurityMaxAge = 64000
	})
}

func TestMiddleWareContentSecurityPolicyHeaders(t *testing.T) {
	policy := `script-src 'self' 'strict-dynamic' 'nonce-[^']+';connect-src 'self' ws://localhost:3000/ wss://localhost:3000/;`

	middlewareScenario(t, "middleware should add Content-Security-Policy", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Regexp(t, policy, sc.resp.Header().Get("Content-Security-Policy"))
	}, func(cfg *setting.Cfg) {
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.AppURL = "http://localhost:3000/"
	})

	middlewareScenario(t, "middleware should add Content-Security-Policy-Report-Only", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Regexp(t, policy, sc.resp.Header().Get("Content-Security-Policy-Report-Only"))
	}, func(cfg *setting.Cfg) {
		cfg.CSPReportOnlyEnabled = true
		cfg.CSPReportOnlyTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.AppURL = "http://localhost:3000/"
	})

	middlewareScenario(t, "middleware can add both CSP and CSP-Report-Only", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()

		cspHeader := sc.resp.Header().Get("Content-Security-Policy")
		cspReportOnlyHeader := sc.resp.Header().Get("Content-Security-Policy-Report-Only")

		assert.Regexp(t, policy, cspHeader)
		assert.Regexp(t, policy, cspReportOnlyHeader)

		// assert CSP-Report-Only reuses the same nonce as CSP
		assert.Equal(t, cspHeader, cspReportOnlyHeader)
	}, func(cfg *setting.Cfg) {
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.CSPReportOnlyEnabled = true
		cfg.CSPReportOnlyTemplate = "script-src 'self' 'strict-dynamic' $NONCE;connect-src 'self' ws://$ROOT_PATH wss://$ROOT_PATH;"
		cfg.AppURL = "http://localhost:3000/"
	})
}

func TestMiddlewareContext(t *testing.T) {
	const noStore = "no-store"

	configureJWTAuthHeader := func(cfg *setting.Cfg) {
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "Authorization"
	}

	middlewareScenario(t, "middleware should add context to injector", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/").exec()
		assert.NotNil(t, sc.context)
	})

	middlewareScenario(t, "Default middleware should allow get request", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/").exec()
		assert.Equal(t, 200, sc.resp.Code)
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests to API", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should pass cache-control on resources with private cache control", func(t *testing.T, sc *scenarioContext) {
		sc = sc.fakeReq("GET", "/api/datasources/1/resources/foo")
		sc.resp.Header().Add("Cache-Control", "private, max-age=86400")
		sc.resp.Header().Add("X-Grafana-Cache", "true")
		sc.exec()
		assert.Equal(t, "private, max-age=86400", sc.resp.Header().Get("Cache-Control"))
	})

	middlewareScenario(t, "middleware should not pass cache-control on resources with public cache control", func(t *testing.T, sc *scenarioContext) {
		sc = sc.fakeReq("GET", "/api/datasources/1/resources/foo")
		sc.resp.Header().Add("Cache-Control", "public, max-age=86400, private")
		sc.resp.Header().Add("X-Grafana-Cache", "true")
		sc.exec()
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
	})

	middlewareScenario(t, "middleware should not add Cache-Control header for requests to datasource proxy API", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/datasources/proxy/1/test").exec()
		assert.Empty(t, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add Cache-Control header for requests with HTML response", func(
		t *testing.T, sc *scenarioContext) {
		sc.handlerFunc = func(c *contextmodel.ReqContext) {
			t.Log("Handler called")
			data := &dtos.IndexViewData{
				User:     &dtos.CurrentUser{},
				Settings: &dtos.FrontendSettingsDTO{},
				NavTree:  &navtree.NavTreeRoot{},
			}
			t.Log("Calling HTML", "data", data)
			c.HTML(http.StatusOK, "index-template", data)
			t.Log("Returned HTML with code 200")
		}
		sc.fakeReq("GET", "/").exec()
		require.Equal(t, 200, sc.resp.Code)
		assert.Equal(t, noStore, sc.resp.Header().Get("Cache-Control"))
		assert.Empty(t, sc.resp.Header().Get("Pragma"))
		assert.Empty(t, sc.resp.Header().Get("Expires"))
	})

	middlewareScenario(t, "middleware should add X-Frame-Options header with deny for request when not allowing embedding", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Equal(t, "deny", sc.resp.Header().Get("X-Frame-Options"))
	})

	middlewareScenario(t, "middleware should not add X-Frame-Options header for request when allowing embedding", func(
		t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/search").exec()
		assert.Empty(t, sc.resp.Header().Get("X-Frame-Options"))
	}, func(cfg *setting.Cfg) {
		cfg.AllowEmbedding = true
	})

	middlewareScenario(t, "Invalid api key", func(t *testing.T, sc *scenarioContext) {
		sc.apiKey = "invalid_key_test"
		sc.fakeReq("GET", "/").exec()

		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidAPIKey, sc.respJson["message"])
	})

	middlewareScenario(t, "Valid API key", func(t *testing.T, sc *scenarioContext) {
		const orgID int64 = 12
		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		sc.apiKeyService.ExpectedAPIKey = &apikey.APIKey{OrgID: orgID, Role: org.RoleEditor, Key: keyhash}

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		require.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, org.RoleEditor, sc.context.OrgRole)
	})

	middlewareScenario(t, "Valid API key with JWT enabled", func(t *testing.T, sc *scenarioContext) {
		const orgID int64 = 12
		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		sc.apiKeyService.ExpectedAPIKey = &apikey.APIKey{OrgID: orgID, Role: org.RoleEditor, Key: keyhash}

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		require.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, org.RoleEditor, sc.context.OrgRole)
	}, configureJWTAuthHeader)

	middlewareScenario(t, "Valid Basic Auth header with JWT enabled and empty 'sub' claim", func(t *testing.T, sc *scenarioContext) {
		const password = "MyPass"
		const orgID int64 = 2
		const userID int64 = 12
		// #nosec G101 -- This is dummy/test token
		const emptySubToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJzdWIiOiIiLCJpYXQiOjE1MTYyMzkwMjJ9.tnwtOHK58d47dO4DHW4b9MzeToxa1kGiko5Oo887Rqc"

		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID}
		authHeader := util.GetBasicAuthHeader("myuser", password)
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).withJWTAuthHeader(emptySubToken).exec()

		require.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, userID, sc.context.UserID)
	}, func(cfg *setting.Cfg) {
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "X-JWT-Token"
		cfg.BasicAuthEnabled = true
	})

	middlewareScenario(t, "Valid Basic Auth header with JWT enabled and missing 'sub' claim", func(t *testing.T, sc *scenarioContext) {
		const password = "MyPass"
		const orgID int64 = 2
		const userID int64 = 12
		// #nosec G101 -- This is dummy/test token
		const missingSubToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.8nYFUX869Y1mnDDDU4yL11aANgVRuifoxrE8BHZY1iE"

		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID}
		authHeader := util.GetBasicAuthHeader("myuser", password)
		sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).withJWTAuthHeader(missingSubToken).exec()

		require.Equal(t, 200, sc.resp.Code)

		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, orgID, sc.context.OrgID)
		assert.Equal(t, userID, sc.context.UserID)
	}, func(cfg *setting.Cfg) {
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "X-JWT-Token"
		cfg.BasicAuthEnabled = true
	})

	middlewareScenario(t, "Valid API key, but does not match DB hash", func(t *testing.T, sc *scenarioContext) {
		const keyhash = "Something_not_matching"
		sc.apiKeyService.ExpectedAPIKey = &apikey.APIKey{OrgID: 12, Role: org.RoleEditor, Key: keyhash}

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, contexthandler.InvalidAPIKey, sc.respJson["message"])
	})

	middlewareScenario(t, "Valid API key, but expired", func(t *testing.T, sc *scenarioContext) {
		sc.contextHandler.GetTime = fakeGetTime()

		keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
		require.NoError(t, err)

		expires := sc.contextHandler.GetTime().Add(-1 * time.Second).Unix()
		sc.apiKeyService.ExpectedAPIKey = &apikey.APIKey{OrgID: 12, Role: org.RoleEditor, Key: keyhash, Expires: &expires}

		sc.fakeReq("GET", "/").withValidApiKey().exec()

		assert.Equal(t, 401, sc.resp.Code)
		assert.Equal(t, "Expired API key", sc.respJson["message"])
	})

	middlewareScenario(t, "Non-expired auth token in cookie which is not being rotated", func(
		t *testing.T, sc *scenarioContext) {
		const userID int64 = 12

		sc.withTokenSessionCookie("token")
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 2, UserID: userID}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        userID,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq("GET", "/").exec()

		require.NotNil(t, sc.context)
		require.NotNil(t, sc.context.UserToken)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, userID, sc.context.UserID)
		assert.Equal(t, userID, sc.context.UserToken.UserId)
		assert.Equal(t, "token", sc.context.UserToken.UnhashedToken)
		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "Non-expired auth token in cookie which is being rotated", func(t *testing.T, sc *scenarioContext) {
		const userID int64 = 12

		sc.withTokenSessionCookie("token")
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 2, UserID: userID}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        userID,
				UnhashedToken: "",
			}, nil
		}

		sc.userAuthTokenService.TryRotateTokenProvider = func(ctx context.Context, userToken *auth.UserToken,
			clientIP net.IP, userAgent string) (bool, *auth.UserToken, error) {
			userToken.UnhashedToken = "rotated"
			return true, userToken, nil
		}

		maxAge := int(sc.cfg.LoginMaxLifetime.Seconds())

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
				if len(sc.cfg.AppSubURL) > 0 {
					expectedCookiePath = sc.cfg.AppSubURL
				}
				expectedCookie := &http.Cookie{
					Name:     sc.cfg.LoginCookieName,
					Value:    "rotated",
					Path:     expectedCookiePath,
					HttpOnly: true,
					MaxAge:   maxAge,
					Secure:   setting.CookieSecure,
					SameSite: sameSiteMode,
				}

				sc.fakeReq("GET", "/").exec()

				assert.True(t, sc.context.IsSignedIn)
				assert.Equal(t, userID, sc.context.UserID)
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
			if len(sc.cfg.AppSubURL) > 0 {
				expectedCookiePath = sc.cfg.AppSubURL
			}
			expectedCookie := &http.Cookie{
				Name:     sc.cfg.LoginCookieName,
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

	middlewareScenario(t, "Invalid/expired auth token in cookie", func(t *testing.T, sc *scenarioContext) {
		sc.withTokenSessionCookie("token")

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return nil, auth.ErrUserTokenNotFound
		}

		sc.fakeReq("GET", "/").exec()

		assert.False(t, sc.context.IsSignedIn)
		assert.Equal(t, int64(0), sc.context.UserID)
		assert.Nil(t, sc.context.UserToken)
	})

	middlewareScenario(t, "Non-expired auth token in cookie and non-expired OAuth access token", func(
		t *testing.T, sc *scenarioContext) {
		const userID int64 = 12
		sc.contextHandler.GetTime = fakeGetTime()

		sc.withTokenSessionCookie("token")
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 2, UserID: userID}
		sc.oauthTokenService.ExpectedAuthUser = &loginsvc.UserAuth{UserId: userID, OAuthExpiry: fakeGetTime()().Add(11 * time.Second)}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        userID,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq("GET", "/").exec()

		require.NotNil(t, sc.context)
		require.NotNil(t, sc.context.UserToken)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, userID, sc.context.UserID)
		assert.Equal(t, userID, sc.context.UserToken.UserId)
		assert.Equal(t, "token", sc.context.UserToken.UnhashedToken)
		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "Non-expired auth token in cookie and expired OAuth access token and refreshing the token fails", func(
		t *testing.T, sc *scenarioContext) {
		const userID int64 = 12
		sc.contextHandler.GetTime = fakeGetTime()

		sc.withTokenSessionCookie("token")
		signedInUser := &user.SignedInUser{OrgID: 2, UserID: userID}
		sc.userService.ExpectedSignedInUser = signedInUser
		sc.oauthTokenService.ExpectedAuthUser = &loginsvc.UserAuth{
			UserId:            userID,
			OAuthExpiry:       fakeGetTime()().Add(-1 * time.Second),
			OAuthAccessToken:  "access_token",
			OAuthRefreshToken: "refresh_token"}
		sc.oauthTokenService.ExpectedErrors = map[string]error{"TryTokenRefresh": errors.New("error")}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        userID,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq("GET", "/").exec()

		token := sc.oauthTokenService.GetCurrentOAuthToken(sc.context.Req.Context(), signedInUser)
		assert.Equal(t, token.AccessToken, "")
		assert.Equal(t, token.RefreshToken, "")
		assert.True(t, token.Expiry.IsZero())

		require.NotNil(t, sc.context)
		require.Nil(t, sc.context.UserToken)
		assert.False(t, sc.context.IsSignedIn)
		assert.Equal(t, int64(0), sc.context.UserID)
		assert.Equal(t, "grafana_session=; Path=/; Max-Age=0; HttpOnly", sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "Non-expired auth token in cookie and expired OAuth access token and refreshing the token succeeds", func(
		t *testing.T, sc *scenarioContext) {
		const userID int64 = 12
		sc.contextHandler.GetTime = fakeGetTime()

		sc.withTokenSessionCookie("token")
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 2, UserID: userID}
		sc.oauthTokenService.ExpectedAuthUser = &loginsvc.UserAuth{UserId: userID, OAuthExpiry: fakeGetTime()().Add(-5 * time.Second), OAuthRefreshToken: "refreshtoken"}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        userID,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq("GET", "/").exec()

		require.NotNil(t, sc.context)
		require.NotNil(t, sc.context.UserToken)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, userID, sc.context.UserID)
		assert.Equal(t, userID, sc.context.UserToken.UserId)
		assert.Equal(t, "token", sc.context.UserToken.UnhashedToken)
		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "Non-expired auth token in cookie and OAuth Access Token's Expiry is not set", func(
		t *testing.T, sc *scenarioContext) {
		const userID int64 = 12
		sc.contextHandler.GetTime = fakeGetTime()

		sc.withTokenSessionCookie("token")
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 2, UserID: userID}
		sc.oauthTokenService.ExpectedAuthUser = &loginsvc.UserAuth{UserId: userID}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        userID,
				UnhashedToken: unhashedToken,
			}, nil
		}

		sc.fakeReq("GET", "/").exec()

		require.NotNil(t, sc.context)
		require.NotNil(t, sc.context.UserToken)
		assert.True(t, sc.context.IsSignedIn)
		assert.Equal(t, userID, sc.context.UserID)
		assert.Equal(t, userID, sc.context.UserToken.UserId)
		assert.Equal(t, "token", sc.context.UserToken.UnhashedToken)
		assert.Empty(t, sc.resp.Header().Get("Set-Cookie"))
	})

	middlewareScenario(t, "When anonymous access is enabled", func(t *testing.T, sc *scenarioContext) {
		sc.orgService.ExpectedOrg = &org.Org{ID: 1, Name: sc.cfg.AnonymousOrgName}
		sc.fakeReq("GET", "/").exec()

		assert.Equal(t, int64(0), sc.context.UserID)
		assert.Equal(t, int64(1), sc.context.OrgID)
		assert.Equal(t, org.RoleEditor, sc.context.OrgRole)
		assert.False(t, sc.context.IsSignedIn)
	}, func(cfg *setting.Cfg) {
		cfg.AnonymousEnabled = true
		cfg.AnonymousOrgName = "test"
		cfg.AnonymousOrgRole = string(org.RoleEditor)
	})

	middlewareScenario(t, "middleware should add custom response headers", func(t *testing.T, sc *scenarioContext) {
		sc.fakeReq("GET", "/api/").exec()
		assert.Regexp(t, "test", sc.resp.Header().Get("X-Custom-Header"))
		assert.Regexp(t, "other-test", sc.resp.Header().Get("X-Other-Header"))
	}, func(cfg *setting.Cfg) {
		cfg.CustomResponseHeaders = map[string]string{
			"X-Custom-Header": "test",
			"X-Other-Header":  "other-test",
		}
	})

	t.Run("auth_proxy", func(t *testing.T) {
		const userID int64 = 33
		const orgID int64 = 4
		const defaultOrgId int64 = 1
		const orgRole = "Admin"

		configure := func(cfg *setting.Cfg) {
			cfg.AuthProxyEnabled = true
			cfg.AuthProxyAutoSignUp = true
			cfg.LDAPEnabled = true
			cfg.AuthProxyHeaderName = "X-WEBAUTH-USER"
			cfg.AuthProxyHeaderProperty = "username"
			cfg.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS", "Role": "X-WEBAUTH-ROLE"}
		}

		const hdrName = "markelog"
		const group = "grafana-core-team"

		middlewareScenario(t, "Should not sync the user if it's in the cache", func(t *testing.T, sc *scenarioContext) {
			sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID}
			h, err := authproxy.HashCacheKey(hdrName + "-" + group)
			require.NoError(t, err)
			key := fmt.Sprintf(authproxy.CachePrefix, h)
			userIdBytes := []byte(strconv.FormatInt(userID, 10))
			err = sc.remoteCacheService.Set(context.Background(), key, userIdBytes, 0)
			require.NoError(t, err)
			sc.fakeReq("GET", "/")

			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.Header.Set("X-WEBAUTH-GROUPS", group)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, orgID, sc.context.OrgID)
		}, configure)

		middlewareScenario(t, "Should respect auto signup option", func(t *testing.T, sc *scenarioContext) {
			var actualAuthProxyAutoSignUp *bool = nil
			sc.loginService.ExpectedUserFunc = func(cmd *loginsvc.UpsertUserCommand) *user.User {
				actualAuthProxyAutoSignUp = &cmd.SignupAllowed
				return nil
			}
			sc.loginService.ExpectedError = login.ErrInvalidCredentials

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.False(t, *actualAuthProxyAutoSignUp)
			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.LDAPEnabled = false
			cfg.AuthProxyAutoSignUp = false
		})

		middlewareScenario(t, "Should create an user from a header", func(t *testing.T, sc *scenarioContext) {
			sc.loginService.ExpectedUser = &user.User{ID: userID}
			sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID}
			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, orgID, sc.context.OrgID)
			list := contexthandler.AuthHTTPHeaderListFromContext(sc.context.Req.Context())
			require.NotNil(t, list)
			require.Contains(t, list.Items, sc.cfg.AuthProxyHeaderName)
			require.Contains(t, list.Items, "X-WEBAUTH-GROUPS")
			require.Contains(t, list.Items, "X-WEBAUTH-ROLE")
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.LDAPEnabled = false
			cfg.AuthProxyAutoSignUp = true
		})

		middlewareScenario(t, "Should assign role from header to default org", func(t *testing.T, sc *scenarioContext) {
			var storedRoleInfo map[int64]org.RoleType = nil
			sc.loginService.ExpectedUserFunc = func(cmd *loginsvc.UpsertUserCommand) *user.User {
				storedRoleInfo = cmd.ExternalUser.OrgRoles
				sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: defaultOrgId, UserID: userID, OrgRole: storedRoleInfo[defaultOrgId]}
				return &user.User{ID: userID}
			}

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.Header.Set("X-WEBAUTH-ROLE", orgRole)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, defaultOrgId, sc.context.OrgID)
			assert.Equal(t, orgRole, string(sc.context.OrgRole))
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.LDAPEnabled = false
			cfg.AuthProxyAutoSignUp = true
		})

		middlewareScenario(t, "Should NOT assign role from header to non-default org", func(t *testing.T, sc *scenarioContext) {
			var storedRoleInfo map[int64]org.RoleType = nil
			sc.loginService.ExpectedUserFunc = func(cmd *loginsvc.UpsertUserCommand) *user.User {
				storedRoleInfo = cmd.ExternalUser.OrgRoles
				sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID, OrgRole: storedRoleInfo[orgID]}
				return &user.User{ID: userID}
			}

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.Header.Set("X-WEBAUTH-ROLE", "Admin")
			sc.req.Header.Set("X-Grafana-Org-Id", strconv.FormatInt(orgID, 10))
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, orgID, sc.context.OrgID)

			// For non-default org, the user role should be empty
			assert.Equal(t, "", string(sc.context.OrgRole))
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.LDAPEnabled = false
			cfg.AuthProxyAutoSignUp = true
		})

		middlewareScenario(t, "Should use organisation specified by targetOrgId parameter", func(t *testing.T, sc *scenarioContext) {
			var targetOrgID int64 = 123
			sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: targetOrgID, UserID: userID}
			sc.loginService.ExpectedUser = &user.User{ID: userID}

			sc.fakeReq("GET", fmt.Sprintf("/?targetOrgId=%d", targetOrgID))
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, targetOrgID, sc.context.OrgID)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.LDAPEnabled = false
			cfg.AuthProxyAutoSignUp = true
		})

		middlewareScenario(t, "Request body should not be read in default context handler", func(t *testing.T, sc *scenarioContext) {
			sc.fakeReq("POST", "/?targetOrgId=123")
			body := "key=value"
			sc.req.Body = io.NopCloser(strings.NewReader(body))

			sc.handlerFunc = func(c *contextmodel.ReqContext) {
				t.Log("Handler called")
				defer func() {
					err := c.Req.Body.Close()
					require.NoError(t, err)
				}()

				bodyAfterHandler, e := io.ReadAll(c.Req.Body)
				require.NoError(t, e)
				require.Equal(t, body, string(bodyAfterHandler))
			}

			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			sc.req.Header.Set("Content-Length", strconv.Itoa(len(body)))
			sc.m.Post("/", sc.defaultHandler)
			sc.exec()
		})

		middlewareScenario(t, "Request body should not be read in default context handler, but query should be altered - jwt", func(t *testing.T, sc *scenarioContext) {
			sc.fakeReq("POST", "/?targetOrgId=123&auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSIsImlhdCI6MTUxNjIzOTAyMn0.1E9qmtctlHAeJzNLPgGFfxdA8WfbEl_vwYO91ffQGxs")
			body := "key=value"
			sc.req.Body = io.NopCloser(strings.NewReader(body))

			sc.handlerFunc = func(c *contextmodel.ReqContext) {
				t.Log("Handler called")
				defer func() {
					err := c.Req.Body.Close()
					require.NoError(t, err)
				}()

				require.Equal(t, "", c.Req.URL.Query().Get("auth_token"))

				bodyAfterHandler, e := io.ReadAll(c.Req.Body)
				require.NoError(t, e)
				require.Equal(t, body, string(bodyAfterHandler))
			}

			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			sc.req.Header.Set("Content-Length", strconv.Itoa(len(body)))
			sc.m.Post("/", sc.defaultHandler)
			sc.exec()
		}, func(cfg *setting.Cfg) {
			cfg.JWTAuthEnabled = true
			cfg.JWTAuthURLLogin = true
			cfg.JWTAuthHeaderName = "X-WEBAUTH-TOKEN"
		})

		middlewareScenario(t, "Should get an existing user from header", func(t *testing.T, sc *scenarioContext) {
			const userID int64 = 12
			const orgID int64 = 2

			sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID}
			sc.loginService.ExpectedUser = &user.User{ID: userID}

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, orgID, sc.context.OrgID)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.LDAPEnabled = false
		})

		middlewareScenario(t, "Should allow the request from whitelist IP", func(t *testing.T, sc *scenarioContext) {
			sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: orgID, UserID: userID}
			sc.loginService.ExpectedUser = &user.User{ID: userID}

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec()

			assert.True(t, sc.context.IsSignedIn)
			assert.Equal(t, userID, sc.context.UserID)
			assert.Equal(t, orgID, sc.context.OrgID)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.AuthProxyWhitelist = "192.168.1.0/24, 2001::0/120"
			cfg.LDAPEnabled = false
		})

		middlewareScenario(t, "Should not allow the request from whitelisted IP", func(t *testing.T, sc *scenarioContext) {
			sc.loginService.ExpectedUser = &user.User{ID: userID}

			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec()

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
			cfg.AuthProxyWhitelist = "8.8.8.8"
			cfg.LDAPEnabled = false
		})

		middlewareScenario(t, "Should return 407 status code if LDAP says no", func(t *testing.T, sc *scenarioContext) {
			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		}, configure)

		middlewareScenario(t, "Should return 407 status code if there is cache mishap", func(t *testing.T, sc *scenarioContext) {
			sc.fakeReq("GET", "/")
			sc.req.Header.Set(sc.cfg.AuthProxyHeaderName, hdrName)
			sc.exec()

			assert.Equal(t, 407, sc.resp.Code)
			assert.Nil(t, sc.context)
		}, configure)
	})
}

func middlewareScenario(t *testing.T, desc string, fn scenarioFunc, cbs ...func(*setting.Cfg)) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		logger := log.New("test")

		loginMaxLifetime, err := gtime.ParseDuration("30d")
		require.NoError(t, err)
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana_session"
		cfg.LoginMaxLifetime = loginMaxLifetime
		// Required when rendering errors
		cfg.ErrTemplateName = "error-template"
		for _, cb := range cbs {
			cb(cfg)
		}

		sc := &scenarioContext{t: t, cfg: cfg}
		viewsPath, err := filepath.Abs("../../public/views")
		require.NoError(t, err)
		exists, err := fs.Exists(viewsPath)
		require.NoError(t, err)
		require.Truef(t, exists, "Views directory should exist at %q", viewsPath)

		sc.m = web.New()
		sc.m.Use(AddCustomResponseHeaders(cfg))
		sc.m.Use(AddDefaultResponseHeaders(cfg))
		sc.m.UseMiddleware(ContentSecurityPolicy(cfg, logger))
		sc.m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))

		sc.mockSQLStore = dbtest.NewFakeDB()
		sc.loginService = &loginservice.LoginServiceMock{}
		sc.userService = usertest.NewUserServiceFake()
		sc.orgService = orgtest.NewOrgServiceFake()
		sc.apiKeyService = &apikeytest.Service{}
		sc.oauthTokenService = &authtest.FakeOAuthTokenService{}
		ctxHdlr := getContextHandler(t, cfg, sc.mockSQLStore, sc.loginService, sc.apiKeyService, sc.userService, sc.orgService, sc.oauthTokenService)
		sc.sqlStore = ctxHdlr.SQLStore
		sc.contextHandler = ctxHdlr
		sc.m.Use(ctxHdlr.Middleware)
		sc.m.Use(OrgRedirect(sc.cfg, sc.userService))

		sc.userAuthTokenService = ctxHdlr.AuthTokenService.(*authtest.FakeUserAuthTokenService)
		sc.jwtAuthService = ctxHdlr.JWTAuthService.(*jwt.FakeJWTService)
		sc.remoteCacheService = ctxHdlr.RemoteCache

		sc.defaultHandler = func(c *contextmodel.ReqContext) {
			require.NotNil(t, c)
			t.Log("Default HTTP handler called")
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
				if !c.Resp.Written() {
					c.Resp.WriteHeader(http.StatusOK)
				}
			} else {
				t.Log("Returning JSON OK")
				resp := make(map[string]interface{})
				resp["message"] = "OK"
				c.JSON(http.StatusOK, resp)
			}
		}

		sc.m.Get("/", sc.defaultHandler)

		fn(t, sc)
	})
}

func getContextHandler(t *testing.T, cfg *setting.Cfg, mockSQLStore *dbtest.FakeDB,
	loginService *loginservice.LoginServiceMock, apiKeyService *apikeytest.Service,
	userService *usertest.FakeUserService, orgService *orgtest.FakeOrgService,
	oauthTokenService *authtest.FakeOAuthTokenService,
) *contexthandler.ContextHandler {
	t.Helper()

	if cfg == nil {
		cfg = setting.NewCfg()
	}
	cfg.RemoteCacheOptions = &setting.RemoteCacheOptions{
		Name: "database",
	}

	remoteCacheSvc := remotecache.NewFakeStore(t)
	userAuthTokenSvc := authtest.NewFakeUserAuthTokenService()
	renderSvc := &fakeRenderService{}
	authJWTSvc := jwt.NewFakeJWTService()
	tracer := tracing.InitializeTracerForTest()
	authProxy := authproxy.ProvideAuthProxy(cfg, remoteCacheSvc, loginService,
		userService, mockSQLStore, &service.LDAPFakeService{ExpectedError: service.ErrUnableToCreateLDAPClient})
	authenticator := &logintest.AuthenticatorFake{ExpectedUser: &user.User{}}
	return contexthandler.ProvideService(cfg, userAuthTokenSvc, authJWTSvc,
		remoteCacheSvc, renderSvc, mockSQLStore, tracer, authProxy,
		loginService, apiKeyService, authenticator, userService, orgService,
		oauthTokenService,
		featuremgmt.WithFeatures(featuremgmt.FlagAccessTokenExpirationCheck),
		&authntest.FakeService{}, &anontest.FakeAnonymousSessionService{})
}

type fakeRenderService struct {
	rendering.Service
}

func (s *fakeRenderService) Init() error {
	return nil
}
