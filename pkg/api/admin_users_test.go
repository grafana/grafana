package api

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	testLogin         = "test@example.com"
	testPassword      = "password"
	nonExistingOrgID  = 1000
	existingTestLogin = "existing@example.com"
)

func TestAdminAPIEndpoint(t *testing.T) {
	const role = org.RoleAdmin
	userService := usertest.NewUserServiceFake()
	t.Run("Given a server admin attempts to remove themselves as an admin", func(t *testing.T) {
		updateCmd := dtos.AdminUpdateUserPermissionsForm{
			IsGrafanaAdmin: false,
		}
		userService := usertest.FakeUserService{ExpectedError: user.ErrLastGrafanaAdmin}
		putAdminScenario(t, "When calling PUT on", "/api/admin/users/1/permissions",
			"/api/admin/users/:id/permissions", role, updateCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)
			}, nil, &userService)
	})

	t.Run("When a server admin attempts to logout himself from all devices", func(t *testing.T) {
		adminLogoutUserScenario(t, "Should not be allowed when calling POST on",
			"/api/admin/users/1/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)
			}, userService)
	})

	t.Run("When a server admin attempts to logout a non-existing user from all devices", func(t *testing.T) {
		mockUserService := usertest.NewUserServiceFake()
		mockUserService.ExpectedError = user.ErrUserNotFound

		adminLogoutUserScenario(t, "Should return not found when calling POST on", "/api/admin/users/200/logout",
			"/api/admin/users/:id/logout", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
			}, mockUserService)
	})

	t.Run("When a server admin attempts to revoke an auth token for a non-existing user", func(t *testing.T) {
		cmd := auth.RevokeAuthTokenCmd{AuthTokenId: 2}
		mockUser := usertest.NewUserServiceFake()
		mockUser.ExpectedError = user.ErrUserNotFound
		adminRevokeUserAuthTokenScenario(t, "Should return not found when calling POST on",
			"/api/admin/users/200/revoke-auth-token", "/api/admin/users/:id/revoke-auth-token", cmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
			}, mockUser)
	})

	t.Run("When a server admin gets auth tokens for a non-existing user", func(t *testing.T) {
		mockUserService := usertest.NewUserServiceFake()
		mockUserService.ExpectedError = user.ErrUserNotFound
		adminGetUserAuthTokensScenario(t, "Should return not found when calling GET on",
			"/api/admin/users/200/auth-tokens", "/api/admin/users/:id/auth-tokens", func(sc *scenarioContext) {
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
			}, mockUserService)
	})

	t.Run("When a server admin attempts to enable/disable a nonexistent user", func(t *testing.T) {
		adminDisableUserScenario(t, "Should return user not found on a POST request", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				userService := sc.userService.(*usertest.FakeUserService)
				sc.authInfoService.ExpectedError = user.ErrUserNotFound

				userService.ExpectedError = user.ErrUserNotFound

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.Equal(t, "user not found", respJSON.Get("message").MustString())
			})

		adminDisableUserScenario(t, "Should return user not found on a POST request", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				userService := sc.userService.(*usertest.FakeUserService)
				sc.authInfoService.ExpectedError = user.ErrUserNotFound
				userService.ExpectedError = user.ErrUserNotFound

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.Equal(t, "user not found", respJSON.Get("message").MustString())
			})
	})

	t.Run("When a server admin attempts to disable/enable external user", func(t *testing.T) {
		adminDisableUserScenario(t, "Should return Could not disable external user error", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 500, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "Could not disable external user", respJSON.Get("message").MustString())

				assert.Equal(t, int64(42), sc.authInfoService.LatestUserID)
			})

		adminDisableUserScenario(t, "Should return Could not enable external user error", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 500, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "Could not enable external user", respJSON.Get("message").MustString())

				userID := sc.authInfoService.LatestUserID
				assert.Equal(t, int64(42), userID)
			})
	})

	t.Run("When a server admin attempts to delete a nonexistent user", func(t *testing.T) {
		adminDeleteUserScenario(t, "Should return user not found error", "/api/admin/users/42",
			"/api/admin/users/:id", func(sc *scenarioContext) {
				sc.userService.(*usertest.FakeUserService).ExpectedError = user.ErrUserNotFound
				sc.authInfoService.ExpectedError = user.ErrUserNotFound
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "user not found", respJSON.Get("message").MustString())
			})
	})

	t.Run("When a server admin attempts to create a user", func(t *testing.T) {
		t.Run("Without an organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    testLogin,
				Password: testPassword,
			}
			usrSvc := &usertest.FakeUserService{ExpectedUser: &user.User{ID: testUserID}}
			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, usrSvc, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 200, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, testUserID, respJSON.Get("id").MustInt64())
				assert.Equal(t, "User created", respJSON.Get("message").MustString())
			})
		})

		t.Run("With an organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    testLogin,
				Password: testPassword,
				OrgId:    testOrgID,
			}
			usrSvc := &usertest.FakeUserService{ExpectedUser: &user.User{ID: testUserID}}
			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, usrSvc, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 200, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, testUserID, respJSON.Get("id").MustInt64())
				assert.Equal(t, "User created", respJSON.Get("message").MustString())
			})
		})

		t.Run("With a nonexistent organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    testLogin,
				Password: testPassword,
				OrgId:    nonExistingOrgID,
			}
			usrSvc := &usertest.FakeUserService{ExpectedError: org.ErrOrgNotFound}
			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, usrSvc, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, org.ErrOrgNotFound.Error(), respJSON.Get("message").MustString())
			})
		})
	})

	t.Run("When a server admin attempts to create a user with an already existing email/login", func(t *testing.T) {
		createCmd := dtos.AdminCreateUserForm{
			Login:    existingTestLogin,
			Password: testPassword,
		}
		usrSvc := &usertest.FakeUserService{ExpectedError: user.ErrUserAlreadyExists}
		adminCreateUserScenario(t, "Should return an error", "/api/admin/users", "/api/admin/users", createCmd, usrSvc, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 412, sc.resp.Code)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, "User with email '' or username 'existing@example.com' already exists", respJSON.Get("message").MustString())
		})
	})
}

func Test_AdminUpdateUserPermissions(t *testing.T) {
	testcases := []struct {
		name                    string
		authModule              string
		allowAssignGrafanaAdmin bool
		authEnabled             bool
		skipOrgRoleSync         bool
		expectedRespCode        int
		enabledAuthnClients     []string
		authnClientConfig       authn.SSOClientConfig
	}{
		// oauth
		{
			name:                "Should allow updating an externally synced OAuth user if Grafana Admin role is not synced",
			authModule:          login.GenericOAuthModule,
			enabledAuthnClients: []string{authn.ClientWithPrefix("generic_oauth")},
			authnClientConfig: &authntest.FakeSSOClientConfig{
				ExpectedIsSkipOrgRoleSyncEnabled:         false,
				ExpectedIsAllowAssignGrafanaAdminEnabled: false,
			},
			expectedRespCode: http.StatusOK,
		},
		{
			name:                "Should allow updating an externally synced OAuth user if OAuth provider is not enabled",
			authModule:          login.GenericOAuthModule,
			expectedRespCode:    http.StatusOK,
			enabledAuthnClients: []string{},
			authnClientConfig: &authntest.FakeSSOClientConfig{
				ExpectedIsSkipOrgRoleSyncEnabled:         false,
				ExpectedIsAllowAssignGrafanaAdminEnabled: true,
			},
		},
		{
			name:                "Should allow updating an externally synced OAuth user if org roles are not being synced",
			authModule:          login.GenericOAuthModule,
			expectedRespCode:    http.StatusOK,
			enabledAuthnClients: []string{authn.ClientWithPrefix("generic_oauth")},
			authnClientConfig: &authntest.FakeSSOClientConfig{
				ExpectedIsSkipOrgRoleSyncEnabled:         true,
				ExpectedIsAllowAssignGrafanaAdminEnabled: true,
			},
		},
		{
			name:                "Should not allow updating an externally synced OAuth user",
			authModule:          login.GenericOAuthModule,
			expectedRespCode:    http.StatusForbidden,
			enabledAuthnClients: []string{authn.ClientWithPrefix("generic_oauth")},
			authnClientConfig: &authntest.FakeSSOClientConfig{
				ExpectedIsSkipOrgRoleSyncEnabled:         false,
				ExpectedIsAllowAssignGrafanaAdminEnabled: true,
			},
		},
		// saml
		{
			name:                "Should allow updating an externally synced SAML user if org roles are not being synced",
			authModule:          login.SAMLAuthModule,
			expectedRespCode:    http.StatusOK,
			enabledAuthnClients: []string{authn.ClientSAML},
			authnClientConfig: &authntest.FakeSSOClientConfig{
				ExpectedIsSkipOrgRoleSyncEnabled:         true,
				ExpectedIsAllowAssignGrafanaAdminEnabled: true,
			},
		},
		{
			name:                "Should not allow updating an externally synced SAML user",
			authModule:          login.SAMLAuthModule,
			expectedRespCode:    http.StatusForbidden,
			enabledAuthnClients: []string{authn.ClientSAML},
			authnClientConfig: &authntest.FakeSSOClientConfig{
				ExpectedIsSkipOrgRoleSyncEnabled:         false,
				ExpectedIsAllowAssignGrafanaAdminEnabled: true,
			},
		},
		// jwt
		{
			name:                    "Should allow updating an externally synced JWT user if Grafana Admin role is not synced",
			authModule:              login.JWTModule,
			authEnabled:             true,
			allowAssignGrafanaAdmin: false,
			skipOrgRoleSync:         false,
			expectedRespCode:        http.StatusOK,
		},
		{
			name:                    "Should allow updating an externally synced JWT user if JWT provider is not enabled",
			authModule:              login.JWTModule,
			authEnabled:             false,
			allowAssignGrafanaAdmin: true,
			skipOrgRoleSync:         false,
			expectedRespCode:        http.StatusOK,
		},
		{
			name:                    "Should allow updating an externally synced JWT user if org roles are not being synced",
			authModule:              login.JWTModule,
			authEnabled:             true,
			allowAssignGrafanaAdmin: true,
			skipOrgRoleSync:         true,
			expectedRespCode:        http.StatusOK,
		},
		{
			name:                    "Should not allow updating an externally synced JWT user",
			authModule:              login.JWTModule,
			authEnabled:             true,
			allowAssignGrafanaAdmin: true,
			skipOrgRoleSync:         false,
			expectedRespCode:        http.StatusForbidden,
		},
	}
	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			userAuth := &login.UserAuth{AuthModule: tc.authModule}
			authInfoService := &authinfotest.FakeService{ExpectedUserAuth: userAuth}
			socialService := &socialtest.FakeSocialService{}
			cfg := setting.NewCfg()

			if tc.authModule == login.JWTModule {
				cfg.JWTAuth.Enabled = tc.authEnabled
				cfg.JWTAuth.SkipOrgRoleSync = tc.skipOrgRoleSync
				cfg.JWTAuth.AllowAssignGrafanaAdmin = tc.allowAssignGrafanaAdmin
			}

			hs := &HTTPServer{
				Cfg:             cfg,
				authInfoService: authInfoService,
				SocialService:   socialService,
				userService:     usertest.NewUserServiceFake(),
				authnService: &authntest.FakeService{
					ExpectedClientConfig: tc.authnClientConfig,
					EnabledClients:       tc.enabledAuthnClients,
				},
			}

			sc := setupScenarioContext(t, "/api/admin/users/1/permissions")
			sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
				c.Req.Body = mockRequestBody(dtos.AdminUpdateUserPermissionsForm{IsGrafanaAdmin: true})
				c.Req.Header.Add("Content-Type", "application/json")
				sc.context = c
				return hs.AdminUpdateUserPermissions(c)
			})

			sc.m.Put("/api/admin/users/:id/permissions", sc.defaultHandler)

			sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

			assert.Equal(t, tc.expectedRespCode, sc.resp.Code)
		})
	}
}

func putAdminScenario(t *testing.T, desc string, url string, routePattern string, role org.RoleType,
	cmd dtos.AdminUpdateUserPermissionsForm, fn scenarioFunc, sqlStore db.DB, userSvc user.Service) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := &HTTPServer{
			Cfg:             setting.NewCfg(),
			SQLStore:        sqlStore,
			authInfoService: &authinfotest.FakeService{ExpectedError: user.ErrUserNotFound},
			userService:     userSvc,
			SocialService:   &mockSocialService{},
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = role

			return hs.AdminUpdateUserPermissions(c)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminLogoutUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc, userService *usertest.FakeUserService) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			AuthTokenService: authtest.NewFakeUserAuthTokenService(),
			userService:      userService,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			t.Log("Route handler invoked", "url", c.Req.URL)

			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin

			return hs.AdminLogoutUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminRevokeUserAuthTokenScenario(t *testing.T, desc string, url string, routePattern string, cmd auth.RevokeAuthTokenCmd, fn scenarioFunc, userService user.Service) {
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
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin

			return hs.AdminRevokeUserAuthToken(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminGetUserAuthTokensScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc, userService *usertest.FakeUserService) {
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
			sc.context.UserID = testUserID
			sc.context.OrgID = testOrgID
			sc.context.OrgRole = org.RoleAdmin

			return hs.AdminGetUserAuthTokens(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminDisableUserScenario(t *testing.T, desc string, action string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		fakeAuthTokenService := authtest.NewFakeUserAuthTokenService()

		authInfoService := &authinfotest.FakeService{}

		hs := HTTPServer{
			SQLStore:         dbtest.NewFakeDB(),
			AuthTokenService: fakeAuthTokenService,
			authInfoService:  authInfoService,
			userService:      usertest.NewUserServiceFake(),
		}

		sc := setupScenarioContext(t, url)
		sc.sqlStore = hs.SQLStore
		sc.authInfoService = authInfoService
		sc.userService = hs.userService
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = testUserID

			if action == "enable" {
				return hs.AdminEnableUser(c)
			}

			return hs.AdminDisableUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminDeleteUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	hs := HTTPServer{
		SQLStore:    dbtest.NewFakeDB(),
		userService: usertest.NewUserServiceFake(),
	}
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		sc := setupScenarioContext(t, url)
		sc.sqlStore = hs.SQLStore
		sc.authInfoService = &authinfotest.FakeService{}
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.UserID = testUserID

			return hs.AdminDeleteUser(c)
		})
		sc.userService = hs.userService

		sc.m.Delete(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminCreateUserScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.AdminCreateUserForm, svc *usertest.FakeUserService, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			userService: svc,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.UserID = testUserID

			return hs.AdminCreateUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
