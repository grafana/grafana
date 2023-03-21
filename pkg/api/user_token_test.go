package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserTokenAPIEndpoint(t *testing.T) {
	userMock := usertest.NewUserServiceFake()
	t.Run("When current user attempts to revoke an auth token for a non-existing user", func(t *testing.T) {
		cmd := auth.RevokeAuthTokenCmd{AuthTokenId: 2}
		userMock.ExpectedError = user.ErrUserNotFound
		revokeUserAuthTokenScenario(t, "Should return not found when calling POST on", "/api/user/revoke-auth-token",
			"/api/user/revoke-auth-token", cmd, 200, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
			}, userMock)
	})

	t.Run("When current user gets auth tokens for a non-existing user", func(t *testing.T) {
		mockUser := &usertest.FakeUserService{
			ExpectedUser:  &user.User{ID: 200},
			ExpectedError: user.ErrUserNotFound,
		}
		getUserAuthTokensScenario(t, "Should return not found when calling GET on", "/api/user/auth-tokens", "/api/user/auth-tokens", 200, func(sc *scenarioContext) {
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
			assert.Equal(t, 404, sc.resp.Code)
		}, mockUser)
	})

	t.Run("When logging out an existing user from all devices", func(t *testing.T) {
		userMock := &usertest.FakeUserService{
			ExpectedUser: &user.User{ID: 200},
		}
		logoutUserFromAllDevicesInternalScenario(t, "Should be successful", 1, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, userMock)
	})

	t.Run("When logout a non-existing user from all devices", func(t *testing.T) {
		logoutUserFromAllDevicesInternalScenario(t, "Should return not found", testUserID, func(sc *scenarioContext) {
			userMock.ExpectedError = user.ErrUserNotFound
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 404, sc.resp.Code)
		}, userMock)
	})

	t.Run("When revoke an auth token for a user", func(t *testing.T) {
		cmd := auth.RevokeAuthTokenCmd{AuthTokenId: 2}
		token := &auth.UserToken{Id: 1}
		mockUser := &usertest.FakeUserService{
			ExpectedUser: &user.User{ID: 200},
		}

		revokeUserAuthTokenInternalScenario(t, "Should be successful", cmd, 200, token, func(sc *scenarioContext) {
			sc.userAuthTokenService.GetUserTokenProvider = func(ctx context.Context, userId, userTokenId int64) (*auth.UserToken, error) {
				return &auth.UserToken{Id: 2}, nil
			}
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, mockUser)
	})

	t.Run("When revoke the active auth token used by himself", func(t *testing.T) {
		cmd := auth.RevokeAuthTokenCmd{AuthTokenId: 2}
		token := &auth.UserToken{Id: 2}
		mockUser := usertest.NewUserServiceFake()
		revokeUserAuthTokenInternalScenario(t, "Should not be successful", cmd, testUserID, token, func(sc *scenarioContext) {
			sc.userAuthTokenService.GetUserTokenProvider = func(ctx context.Context, userId, userTokenId int64) (*auth.UserToken, error) {
				return token, nil
			}
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 400, sc.resp.Code)
		}, mockUser)
	})

	t.Run("When gets auth tokens for a user", func(t *testing.T) {
		currentToken := &auth.UserToken{Id: 1}
		mockUser := usertest.NewUserServiceFake()
		getUserAuthTokensInternalScenario(t, "Should be successful", currentToken, func(sc *scenarioContext) {
			tokens := []*auth.UserToken{
				{
					Id:        1,
					ClientIp:  "127.0.0.1",
					UserAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.119 Safari/537.36",
					CreatedAt: time.Now().Unix(),
					SeenAt:    time.Now().Unix(),
				},
				{
					Id:        2,
					ClientIp:  "127.0.0.2",
					UserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1",
					CreatedAt: time.Now().Unix(),
					SeenAt:    0,
				},
			}
			sc.userAuthTokenService.GetUserTokensProvider = func(ctx context.Context, userId int64) ([]*auth.UserToken, error) {
				return tokens, nil
			}
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			assert.Equal(t, 200, sc.resp.Code)
			result := sc.ToJSON()
			assert.Len(t, result.MustArray(), 2)

			resultOne := result.GetIndex(0)
			assert.Equal(t, tokens[0].Id, resultOne.Get("id").MustInt64())
			assert.True(t, resultOne.Get("isActive").MustBool())
			assert.Equal(t, "127.0.0.1", resultOne.Get("clientIp").MustString())
			assert.Equal(t, time.Unix(tokens[0].CreatedAt, 0).Format(time.RFC3339), resultOne.Get("createdAt").MustString())
			assert.Equal(t, time.Unix(tokens[0].SeenAt, 0).Format(time.RFC3339), resultOne.Get("seenAt").MustString())

			assert.Equal(t, "Other", resultOne.Get("device").MustString())
			assert.Equal(t, "Chrome", resultOne.Get("browser").MustString())
			assert.Equal(t, "72.0", resultOne.Get("browserVersion").MustString())
			assert.Equal(t, "Linux", resultOne.Get("os").MustString())
			assert.Empty(t, resultOne.Get("osVersion").MustString())

			resultTwo := result.GetIndex(1)
			assert.Equal(t, tokens[1].Id, resultTwo.Get("id").MustInt64())
			assert.False(t, resultTwo.Get("isActive").MustBool())
			assert.Equal(t, "127.0.0.2", resultTwo.Get("clientIp").MustString())
			assert.Equal(t, time.Unix(tokens[1].CreatedAt, 0).Format(time.RFC3339), resultTwo.Get("createdAt").MustString())
			assert.Equal(t, time.Unix(tokens[1].CreatedAt, 0).Format(time.RFC3339), resultTwo.Get("seenAt").MustString())

			assert.Equal(t, "iPhone", resultTwo.Get("device").MustString())
			assert.Equal(t, "Mobile Safari", resultTwo.Get("browser").MustString())
			assert.Equal(t, "11.0", resultTwo.Get("browserVersion").MustString())
			assert.Equal(t, "iOS", resultTwo.Get("os").MustString())
			assert.Equal(t, "11.0", resultTwo.Get("osVersion").MustString())
		}, mockUser)
	})
}

func TestHTTPServer_RotateUserAuthToken(t *testing.T) {
	type testCase struct {
		desc                 string
		cookie               *http.Cookie
		rotatedToken         *auth.UserToken
		rotatedErr           error
		expectedStatus       int
		expectNewSession     bool
		expectSessionDeleted bool
	}

	tests := []testCase{
		{
			desc:                 "Should return 401 and delete cookie if the token is invalid",
			cookie:               &http.Cookie{Name: "grafana_session", Value: "123", Path: "/"},
			rotatedErr:           auth.ErrInvalidSessionToken,
			expectSessionDeleted: true,
			expectedStatus:       http.StatusUnauthorized,
		},
		{
			desc:           "Should return 404 and when token s not found",
			cookie:         &http.Cookie{Name: "grafana_session", Value: "123", Path: "/"},
			rotatedErr:     auth.ErrUserTokenNotFound,
			expectedStatus: http.StatusNotFound,
		},
		{
			desc:           "Should return 200 and but not set new cookie if token was not rotated",
			cookie:         &http.Cookie{Name: "grafana_session", Value: "123", Path: "/"},
			rotatedToken:   &auth.UserToken{UnhashedToken: "123"},
			expectedStatus: http.StatusOK,
		},
		{
			desc:             "Should return 200 and set new session and expiry cookies",
			cookie:           &http.Cookie{Name: "grafana_session", Value: "123", Path: "/"},
			rotatedToken:     &auth.UserToken{UnhashedToken: "new"},
			expectNewSession: true,
			expectedStatus:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				cfg := setting.NewCfg()
				cfg.LoginCookieName = "grafana_session"
				cfg.LoginMaxLifetime = 10 * time.Hour
				hs.Cfg = cfg
				hs.log = log.New()
				hs.Cfg.LoginCookieName = "grafana_session"
				hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation)
				hs.AuthTokenService = &authtest.FakeUserAuthTokenService{
					RotateTokenProvider: func(ctx context.Context, cmd auth.RotateCommand) (*auth.UserToken, error) {
						return tt.rotatedToken, tt.rotatedErr
					},
				}
			})

			req := server.NewPostRequest("/api/user/auth-tokens/rotate", nil)
			if tt.cookie != nil {
				req.AddCookie(tt.cookie)
			}

			res, err := server.Send(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedStatus, res.StatusCode)

			if tt.expectedStatus != http.StatusOK {
				if tt.expectSessionDeleted {
					cookies := res.Header.Values("Set-Cookie")
					require.Len(t, cookies, 2)
					assert.Equal(t, "grafana_session=; Path=/; Max-Age=0; HttpOnly", cookies[0])
					assert.Equal(t, "grafana_session_expiry=; Path=/; Max-Age=0", cookies[1])
				} else {
					assert.Empty(t, res.Header.Get("Set-Cookie"))
				}
			} else {
				if tt.expectNewSession {
					cookies := res.Header.Values("Set-Cookie")
					require.Len(t, cookies, 2)
					assert.Equal(t, "grafana_session=new; Path=/; Max-Age=36000; HttpOnly", cookies[0])
					assert.Equal(t, "grafana_session_expiry=-5; Path=/; Max-Age=36000", cookies[1])
				} else {
					assert.Empty(t, res.Header.Get("Set-Cookie"))
				}
			}

			require.NoError(t, res.Body.Close())
		})
	}
}

func revokeUserAuthTokenScenario(t *testing.T, desc string, url string, routePattern string, cmd auth.RevokeAuthTokenCmd,
	userId int64, fn scenarioFunc, userService user.Service) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		fakeAuthTokenService := authtest.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			AuthTokenService: fakeAuthTokenService,
			userService:      userService,
		}

		sc := setupScenarioContext(t, url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			sc.context = c
			sc.context.UserID = userId
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin

			return hs.RevokeUserAuthToken(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func getUserAuthTokensScenario(t *testing.T, desc string, url string, routePattern string, userId int64, fn scenarioFunc, userService user.Service) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		fakeAuthTokenService := authtest.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			AuthTokenService: fakeAuthTokenService,
			userService:      userService,
		}

		sc := setupScenarioContext(t, url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = userId
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin

			return hs.GetUserAuthTokens(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func logoutUserFromAllDevicesInternalScenario(t *testing.T, desc string, userId int64, fn scenarioFunc, userService user.Service) {
	t.Run(desc, func(t *testing.T) {
		hs := HTTPServer{
			AuthTokenService: authtest.NewFakeUserAuthTokenService(),
			userService:      userService,
		}

		sc := setupScenarioContext(t, "/")
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin

			return hs.logoutUserFromAllDevicesInternal(context.Background(), userId)
		})

		sc.m.Post("/", sc.defaultHandler)

		fn(sc)
	})
}

func revokeUserAuthTokenInternalScenario(t *testing.T, desc string, cmd auth.RevokeAuthTokenCmd, userId int64,
	token *auth.UserToken, fn scenarioFunc, userService user.Service) {
	t.Run(desc, func(t *testing.T) {
		fakeAuthTokenService := authtest.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			AuthTokenService: fakeAuthTokenService,
			userService:      userService,
		}

		sc := setupScenarioContext(t, "/")
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin
			sc.context.UserToken = token

			return hs.revokeUserAuthTokenInternal(c, userId, cmd)
		})
		sc.m.Post("/", sc.defaultHandler)
		fn(sc)
	})
}

func getUserAuthTokensInternalScenario(t *testing.T, desc string, token *auth.UserToken, fn scenarioFunc, userService user.Service) {
	t.Run(desc, func(t *testing.T) {
		fakeAuthTokenService := authtest.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			AuthTokenService: fakeAuthTokenService,
			userService:      userService,
		}

		sc := setupScenarioContext(t, "/")
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin
			sc.context.UserToken = token

			return hs.getUserAuthTokensInternal(c, testUserID)
		})

		sc.m.Get("/", sc.defaultHandler)

		fn(sc)
	})
}
