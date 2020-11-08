package api

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/middleware"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	TestLogin        = "test@example.com"
	TestPassword     = "password"
	nonExistingOrgID = 1000
)

func TestAdminAPIEndpoint(t *testing.T) {
	const role = models.ROLE_ADMIN

	t.Run("Given a server admin attempts to remove themself as an admin", func(t *testing.T) {
		updateCmd := dtos.AdminUpdateUserPermissionsForm{
			IsGrafanaAdmin: false,
		}

		bus.AddHandler("test", func(cmd *models.UpdateUserPermissionsCommand) error {
			return models.ErrLastGrafanaAdmin
		})

		putAdminScenario(t, "When calling PUT on", "/api/admin/users/1/permissions",
			"/api/admin/users/:id/permissions", role, updateCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)
			})
	})

	t.Run("When a server admin attempts to logout himself from all devices", func(t *testing.T) {
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			cmd.Result = &models.User{Id: TestUserID}
			return nil
		})

		adminLogoutUserScenario(t, "Should not be allowed when calling POST on",
			"/api/admin/users/1/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)
			})
	})

	t.Run("When a server admin attempts to logout a non-existing user from all devices", func(t *testing.T) {
		userID := int64(0)
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			userID = cmd.Id
			return models.ErrUserNotFound
		})

		adminLogoutUserScenario(t, "Should return not found when calling POST on", "/api/admin/users/200/logout",
			"/api/admin/users/:id/logout", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, int64(200), userID)
			})
	})

	t.Run("When a server admin attempts to revoke an auth token for a non-existing user", func(t *testing.T) {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			userId = cmd.Id
			return models.ErrUserNotFound
		})

		cmd := models.RevokeAuthTokenCmd{AuthTokenId: 2}

		adminRevokeUserAuthTokenScenario(t, "Should return not found when calling POST on",
			"/api/admin/users/200/revoke-auth-token", "/api/admin/users/:id/revoke-auth-token", cmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, 200, userId)
			})
	})

	t.Run("When a server admin gets auth tokens for a non-existing user", func(t *testing.T) {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			userId = cmd.Id
			return models.ErrUserNotFound
		})

		adminGetUserAuthTokensScenario(t, "Should return not found when calling GET on",
			"/api/admin/users/200/auth-tokens", "/api/admin/users/:id/auth-tokens", func(sc *scenarioContext) {
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, 200, userId)
			})
	})

	t.Run("When a server admin attempts to enable/disable a nonexistent user", func(t *testing.T) {
		var userId int64
		isDisabled := false
		bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
			return models.ErrUserNotFound
		})

		bus.AddHandler("test", func(cmd *models.DisableUserCommand) error {
			userId = cmd.UserId
			isDisabled = cmd.IsDisabled
			return models.ErrUserNotFound
		})

		adminDisableUserScenario(t, "Should return user not found on a POST request", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.Equal(t, "user not found", respJSON.Get("message").MustString())

				assert.Equal(t, 42, userId)
				assert.Equal(t, false, isDisabled)
			})

		adminDisableUserScenario(t, "Should return user not found on a POST request", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.Equal(t, "user not found", respJSON.Get("message").MustString())

				assert.Equal(t, 42, userId)
				assert.Equal(t, true, isDisabled)
			})
	})

	t.Run("When a server admin attempts to disable/enable external user", func(t *testing.T) {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
			userId = cmd.UserId
			return nil
		})

		adminDisableUserScenario(t, "Should return Could not disable external user error", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 500, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "Could not disable external user", respJSON.Get("message").MustString())

				assert.Equal(t, 42, userId)
			})

		adminDisableUserScenario(t, "Should return Could not enable external user error", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 500, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "Could not enable external user", respJSON.Get("message").MustString())

				assert.Equal(t, 42, userId)
			})
	})

	t.Run("When a server admin attempts to delete a nonexistent user", func(t *testing.T) {
		var userId int64
		bus.AddHandler("test", func(cmd *models.DeleteUserCommand) error {
			userId = cmd.UserId
			return models.ErrUserNotFound
		})

		adminDeleteUserScenario(t, "Should return user not found error", "/api/admin/users/42",
			"/api/admin/users/:id", func(sc *scenarioContext) {
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "user not found", respJSON.Get("message").MustString())

				assert.Equal(t, 42, userId)
			})
	})

	t.Run("When a server admin attempts to create a user", func(t *testing.T) {
		var userLogin string
		var orgId int64

		bus.AddHandler("test", func(cmd *models.CreateUserCommand) error {
			userLogin = cmd.Login
			orgId = cmd.OrgId

			if orgId == nonExistingOrgID {
				return models.ErrOrgNotFound
			}

			cmd.Result = models.User{Id: TestUserID}
			return nil
		})

		t.Run("Without an organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    TestLogin,
				Password: TestPassword,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 200, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, TestUserID, respJSON.Get("id").MustInt64())
				assert.Equal(t, "User created", respJSON.Get("message").MustString())

				// test that userLogin and orgId were transmitted correctly to the handler
				assert.Equal(t, TestLogin, userLogin)
				assert.Equal(t, 0, orgId)
			})
		})

		t.Run("With an organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    TestLogin,
				Password: TestPassword,
				OrgId:    TestOrgID,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 200, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, TestUserID, respJSON.Get("id").MustInt64())
				assert.Equal(t, "User created", respJSON.Get("message").MustString())

				assert.Equal(t, TestLogin, userLogin)
				assert.Equal(t, TestOrgID, orgId)
			})
		})

		t.Run("With a nonexistent organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    TestLogin,
				Password: TestPassword,
				OrgId:    nonExistingOrgID,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "organization not found", respJSON.Get("message").MustString())

				assert.Equal(t, TestLogin, userLogin)
				assert.Equal(t, 1000, orgId)
			})
		})
	})

	t.Run("When a server admin attempts to create a user with an already existing email/login", func(t *testing.T) {
		bus.AddHandler("test", func(cmd *models.CreateUserCommand) error {
			return models.ErrUserAlreadyExists
		})

		createCmd := dtos.AdminCreateUserForm{
			Login:    TestLogin,
			Password: TestPassword,
		}

		adminCreateUserScenario(t, "Should return an error", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 412, sc.resp.Code)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, "user already exists", respJSON.Get("error").MustString())
		})
	})
}

func putAdminScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType, cmd dtos.AdminUpdateUserPermissionsForm, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			return AdminUpdateUserPermissions(c, cmd)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminLogoutUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: auth.NewFakeUserAuthTokenService(),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.AdminLogoutUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminRevokeUserAuthTokenScenario(t *testing.T, desc string, url string, routePattern string, cmd models.RevokeAuthTokenCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(t, url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.AdminRevokeUserAuthToken(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminGetUserAuthTokensScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(t, url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.AdminGetUserAuthTokens(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminDisableUserScenario(t *testing.T, desc string, action string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID

			if action == "enable" {
				return AdminEnableUser(c)
			}

			return hs.AdminDisableUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminDeleteUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID

			return AdminDeleteUser(c)
		})

		sc.m.Delete(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminCreateUserScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.AdminCreateUserForm, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID

			return AdminCreateUser(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
