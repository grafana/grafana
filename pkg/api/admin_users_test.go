package api

import (
	"fmt"
	"io"
	"net/http"
	"strings"
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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/star/startest"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
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

func TestAdminUsersAuthorization_SingleOrgAdminCanDeleteWithPermission(t *testing.T) {
	server := setupAdminUsersAuthorizationServer(t, true, nil)
	caller := adminUsersAuthorizationCaller(map[string][]string{
		accesscontrol.ActionUsersDelete: {"global.users:id:*"},
	})

	res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/admin/users/42", nil), caller))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode, string(body))
	require.JSONEq(t, `{"message":"User deleted"}`, string(body))
}

func TestAdminUsersAuthorization_MultiOrgRejectsOrganizationGrants(t *testing.T) {
	for _, tc := range []struct {
		name   string
		method string
		path   string
		action string
	}{
		{"create", http.MethodPost, "/api/admin/users", accesscontrol.ActionUsersCreate},
		{"password", http.MethodPut, "/api/admin/users/42/password", accesscontrol.ActionUsersPasswordUpdate},
		{"delete", http.MethodDelete, "/api/admin/users/42", accesscontrol.ActionUsersDelete},
		{"disable", http.MethodPost, "/api/admin/users/42/disable", accesscontrol.ActionUsersDisable},
		{"enable", http.MethodPost, "/api/admin/users/42/enable", accesscontrol.ActionUsersEnable},
		{"read quotas", http.MethodGet, "/api/admin/users/42/quotas", accesscontrol.ActionUsersQuotasList},
		{"update quota", http.MethodPut, "/api/admin/users/42/quotas/session", accesscontrol.ActionUsersQuotasUpdate},
		{"logout", http.MethodPost, "/api/admin/users/42/logout", accesscontrol.ActionUsersLogout},
		{"read tokens", http.MethodGet, "/api/admin/users/42/auth-tokens", accesscontrol.ActionUsersAuthTokenList},
		{"revoke token", http.MethodPost, "/api/admin/users/42/revoke-auth-token", accesscontrol.ActionUsersAuthTokenUpdate},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := setupAdminUsersAuthorizationServer(t, false, nil)
			caller := adminUsersAuthorizationCaller(map[string][]string{tc.action: {"global.users:*"}})
			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(tc.method, tc.path, nil), caller))
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			require.Equal(t, http.StatusForbidden, res.StatusCode, string(body))
			require.Contains(t, string(body), "Permissions needed: "+tc.action)
		})
	}
}

func TestAdminUsersAuthorization_DeletePermissions(t *testing.T) {
	for _, tc := range []struct {
		name              string
		singleOrg         bool
		orgPermissions    map[string][]string
		globalPermissions map[string][]string
		expectedStatus    int
	}{
		{
			name:           "single org admin without delete permission is denied",
			singleOrg:      true,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "single org admin with read permission cannot delete",
			singleOrg:      true,
			orgPermissions: map[string][]string{accesscontrol.ActionUsersRead: {"global.users:id:*"}},
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "single org admin with permission for another user is denied",
			singleOrg:      true,
			orgPermissions: map[string][]string{accesscontrol.ActionUsersDelete: {"global.users:id:43"}},
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "multi org admin without delete permission is denied",
			expectedStatus: http.StatusForbidden,
		},
		{
			name:              "multi org admin with global permission for another user is denied despite matching org permission",
			orgPermissions:    map[string][]string{accesscontrol.ActionUsersDelete: {"global.users:id:42"}},
			globalPermissions: map[string][]string{accesscontrol.ActionUsersDelete: {"global.users:id:43"}},
			expectedStatus:    http.StatusForbidden,
		},
		{
			name:              "multi org admin with global wildcard permission can delete",
			globalPermissions: map[string][]string{accesscontrol.ActionUsersDelete: {"global.users:id:*"}},
			expectedStatus:    http.StatusOK,
		},
		{
			name:              "multi org admin with global permission for the target can delete",
			globalPermissions: map[string][]string{accesscontrol.ActionUsersDelete: {"global.users:id:42"}},
			expectedStatus:    http.StatusOK,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := setupAdminUsersAuthorizationServer(t, tc.singleOrg, tc.globalPermissions)
			caller := adminUsersAuthorizationCaller(tc.orgPermissions)
			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/admin/users/42", nil), caller))
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			require.Equal(t, tc.expectedStatus, res.StatusCode, string(body))
			if tc.expectedStatus == http.StatusOK {
				require.JSONEq(t, `{"message":"User deleted"}`, string(body))
			} else {
				require.Contains(t, string(body), "Permissions needed: users:delete")
			}
		})
	}
}

func TestAdminUsersAuthorization_OrgAdminCannotGrantServerAdmin(t *testing.T) {
	for _, tc := range []struct {
		name      string
		singleOrg bool
	}{
		{"single org", true},
		{"multi org", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			permissions := map[string][]string{accesscontrol.ActionUsersPermissionsUpdate: {"global.users:id:*"}}
			server := setupAdminUsersAuthorizationServer(t, tc.singleOrg, permissions)
			caller := adminUsersAuthorizationCaller(permissions)
			req := server.NewRequest(http.MethodPut, "/api/admin/users/42/permissions", strings.NewReader(`{"isGrafanaAdmin":true}`))
			req.Header.Set("Content-Type", "application/json")
			res, err := server.Send(webtest.RequestWithSignedInUser(req, caller))
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, res.Body.Close()) })
			require.Equal(t, http.StatusForbidden, res.StatusCode)
		})
	}
}

func adminUsersAuthorizationCaller(permissions map[string][]string) *user.SignedInUser {
	return &user.SignedInUser{
		UserID:      1,
		UserUID:     "org-admin",
		OrgID:       1,
		OrgRole:     org.RoleAdmin,
		Permissions: map[int64]map[string][]string{1: permissions},
	}
}

func setupAdminUsersAuthorizationServer(t *testing.T, singleOrg bool, globalPermissions map[string][]string) *webtest.Server {
	t.Helper()
	return SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.Cfg.RBAC.SingleOrganization = singleOrg
		// Authentication supplies separate permission snapshots for the same caller in each organization.
		hs.authnService = &authntest.FakeService{ExpectedIdentity: &authn.Identity{
			ID:          "1",
			UID:         "org-admin",
			OrgID:       accesscontrol.GlobalOrgID,
			OrgRoles:    map[int64]org.RoleType{accesscontrol.GlobalOrgID: org.RoleNone},
			Permissions: map[int64]map[string][]string{accesscontrol.GlobalOrgID: globalPermissions},
		}}
		hs.userService = &usertest.FakeUserService{ExpectedUser: &user.User{ID: 42, UID: "target-user"}}
		hs.starService = &startest.FakeStarService{}
		hs.orgService = &orgtest.FakeOrgService{}
		hs.preferenceService = &preftest.FakePreferenceService{}
		hs.TeamService = &teamtest.FakeService{}
		hs.authInfoService = &authinfotest.FakeService{}
		hs.AuthTokenService = authtest.NewFakeUserAuthTokenService()
		hs.accesscontrolService = &actest.FakeService{}
	})
}
