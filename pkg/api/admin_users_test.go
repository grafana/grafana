package api

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testLogin         = "test@example.com"
	testPassword      = "password"
	nonExistingOrgID  = 1000
	existingTestLogin = "existing@example.com"
)

func TestAdminAPIEndpoint(t *testing.T) {
	const role = models.ROLE_ADMIN

	t.Run("Given a server admin attempts to remove themselves as an admin", func(t *testing.T) {
		updateCmd := dtos.AdminUpdateUserPermissionsForm{
			IsGrafanaAdmin: false,
		}

		putAdminScenario(t, "When calling PUT on", "/api/admin/users/1/permissions",
			"/api/admin/users/:id/permissions", role, updateCmd, func(sc *scenarioContext) {
				// TODO: Use a fake SQLStore when it's represented by an interface
				origUpdateUserPermissions := updateUserPermissions
				t.Cleanup(func() {
					updateUserPermissions = origUpdateUserPermissions
				})

				updateUserPermissions = func(sqlStore *sqlstore.SQLStore, userID int64, isAdmin bool) error {
					return models.ErrLastGrafanaAdmin
				}

				sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)
			})
	})

	t.Run("When a server admin attempts to logout himself from all devices", func(t *testing.T) {
		adminLogoutUserScenario(t, "Should not be allowed when calling POST on",
			"/api/admin/users/1/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
				bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.GetUserByIdQuery) error {
					cmd.Result = &models.User{Id: testUserID}
					return nil
				})

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)
			})
	})

	t.Run("When a server admin attempts to logout a non-existing user from all devices", func(t *testing.T) {
		adminLogoutUserScenario(t, "Should return not found when calling POST on", "/api/admin/users/200/logout",
			"/api/admin/users/:id/logout", func(sc *scenarioContext) {
				userID := int64(0)

				bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.GetUserByIdQuery) error {
					userID = cmd.Id
					return models.ErrUserNotFound
				})
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, int64(200), userID)
			})
	})

	t.Run("When a server admin attempts to revoke an auth token for a non-existing user", func(t *testing.T) {
		cmd := models.RevokeAuthTokenCmd{AuthTokenId: 2}

		adminRevokeUserAuthTokenScenario(t, "Should return not found when calling POST on",
			"/api/admin/users/200/revoke-auth-token", "/api/admin/users/:id/revoke-auth-token", cmd, func(sc *scenarioContext) {
				var userID int64
				bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.GetUserByIdQuery) error {
					userID = cmd.Id
					return models.ErrUserNotFound
				})

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, int64(200), userID)
			})
	})

	t.Run("When a server admin gets auth tokens for a non-existing user", func(t *testing.T) {
		adminGetUserAuthTokensScenario(t, "Should return not found when calling GET on",
			"/api/admin/users/200/auth-tokens", "/api/admin/users/:id/auth-tokens", func(sc *scenarioContext) {
				var userID int64
				bus.AddHandlerCtx("test", func(ctx context.Context, cmd *models.GetUserByIdQuery) error {
					userID = cmd.Id
					return models.ErrUserNotFound
				})

				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, int64(200), userID)
			})
	})

	t.Run("When a server admin attempts to enable/disable a nonexistent user", func(t *testing.T) {
		adminDisableUserScenario(t, "Should return user not found on a POST request", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				var userID int64
				isDisabled := false
				bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
					return models.ErrUserNotFound
				})

				bus.AddHandler("test", func(cmd *models.DisableUserCommand) error {
					userID = cmd.UserId
					isDisabled = cmd.IsDisabled
					return models.ErrUserNotFound
				})

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.Equal(t, "user not found", respJSON.Get("message").MustString())

				assert.Equal(t, int64(42), userID)
				assert.Equal(t, false, isDisabled)
			})

		adminDisableUserScenario(t, "Should return user not found on a POST request", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				var userID int64
				isDisabled := false
				bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
					return models.ErrUserNotFound
				})

				bus.AddHandler("test", func(cmd *models.DisableUserCommand) error {
					userID = cmd.UserId
					isDisabled = cmd.IsDisabled
					return models.ErrUserNotFound
				})

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)

				assert.Equal(t, "user not found", respJSON.Get("message").MustString())

				assert.Equal(t, int64(42), userID)
				assert.Equal(t, true, isDisabled)
			})
	})

	t.Run("When a server admin attempts to disable/enable external user", func(t *testing.T) {
		adminDisableUserScenario(t, "Should return Could not disable external user error", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				var userID int64
				bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
					userID = cmd.UserId
					return nil
				})

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 500, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "Could not disable external user", respJSON.Get("message").MustString())

				assert.Equal(t, int64(42), userID)
			})

		adminDisableUserScenario(t, "Should return Could not enable external user error", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				var userID int64
				bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
					userID = cmd.UserId
					return nil
				})

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 500, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "Could not enable external user", respJSON.Get("message").MustString())

				assert.Equal(t, int64(42), userID)
			})
	})

	t.Run("When a server admin attempts to delete a nonexistent user", func(t *testing.T) {
		adminDeleteUserScenario(t, "Should return user not found error", "/api/admin/users/42",
			"/api/admin/users/:id", func(sc *scenarioContext) {
				var userID int64
				bus.AddHandler("test", func(cmd *models.DeleteUserCommand) error {
					userID = cmd.UserId
					return models.ErrUserNotFound
				})

				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

				assert.Equal(t, 404, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "user not found", respJSON.Get("message").MustString())

				assert.Equal(t, int64(42), userID)
			})
	})

	t.Run("When a server admin attempts to create a user", func(t *testing.T) {
		t.Run("Without an organization", func(t *testing.T) {
			createCmd := dtos.AdminCreateUserForm{
				Login:    testLogin,
				Password: testPassword,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				bus.ClearBusHandlers()

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

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				bus.ClearBusHandlers()

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

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				bus.ClearBusHandlers()

				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				assert.Equal(t, 400, sc.resp.Code)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				require.NoError(t, err)
				assert.Equal(t, "organization not found", respJSON.Get("message").MustString())
			})
		})
	})

	t.Run("When a server admin attempts to create a user with an already existing email/login", func(t *testing.T) {
		createCmd := dtos.AdminCreateUserForm{
			Login:    existingTestLogin,
			Password: testPassword,
		}

		adminCreateUserScenario(t, "Should return an error", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
			bus.ClearBusHandlers()

			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			assert.Equal(t, 412, sc.resp.Code)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			require.NoError(t, err)
			assert.Equal(t, "user already exists", respJSON.Get("error").MustString())
		})
	})
}

func putAdminScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType,
	cmd dtos.AdminUpdateUserPermissionsForm, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		hs := &HTTPServer{
			Cfg: setting.NewCfg(),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = role

			return hs.AdminUpdateUserPermissions(c, cmd)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminLogoutUserScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: auth.NewFakeUserAuthTokenService(),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			t.Log("Route handler invoked", "url", c.Req.URL)

			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.AdminLogoutUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminRevokeUserAuthTokenScenario(t *testing.T, desc string, url string, routePattern string, cmd models.RevokeAuthTokenCmd, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(t, url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.AdminRevokeUserAuthToken(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminGetUserAuthTokensScenario(t *testing.T, desc string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(t, url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID
			sc.context.OrgId = testOrgID
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.AdminGetUserAuthTokens(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminDisableUserScenario(t *testing.T, desc string, action string, url string, routePattern string, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID

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
		t.Cleanup(bus.ClearBusHandlers)

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID

			return AdminDeleteUser(c)
		})

		sc.m.Delete(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminCreateUserScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.AdminCreateUserForm, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		t.Cleanup(bus.ClearBusHandlers)

		hs := HTTPServer{
			Bus:   bus.GetBus(),
			Login: fakeLoginService{expected: cmd},
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
			sc.context = c
			sc.context.UserId = testUserID

			return hs.AdminCreateUser(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

type fakeLoginService struct {
	login.Service
	expected dtos.AdminCreateUserForm
}

func (s fakeLoginService) CreateUser(cmd models.CreateUserCommand) (*models.User, error) {
	if cmd.OrgId == nonExistingOrgID {
		return nil, models.ErrOrgNotFound
	}

	if cmd.Login == existingTestLogin {
		return nil, models.ErrUserAlreadyExists
	}

	if s.expected.Login == cmd.Login && s.expected.Email == cmd.Email &&
		s.expected.Password == cmd.Password && s.expected.Name == cmd.Name && s.expected.OrgId == cmd.OrgId {
		return &models.User{Id: testUserID}, nil
	}

	return nil, errors.New("unexpected cmd")
}
