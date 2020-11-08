package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"

	. "github.com/smartystreets/goconvey/convey"
)

const (
	TestLogin        = "test@example.com"
	TestPassword     = "password"
	nonExistingOrgID = 1000
)

func TestAdminApiEndpoint(t *testing.T) {
	role := models.ROLE_ADMIN
	Convey("Given a server admin attempts to remove themself as an admin", t, func() {
		updateCmd := dtos.AdminUpdateUserPermissionsForm{
			IsGrafanaAdmin: false,
		}

		bus.AddHandler("test", func(cmd *models.UpdateUserPermissionsCommand) error {
			return models.ErrLastGrafanaAdmin
		})

		putAdminScenario(t, "When calling PUT on", "/api/admin/users/1/permissions",
			"/api/admin/users/:id/permissions", role, updateCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 400)
			})
	})

	Convey("When a server admin attempts to logout himself from all devices", t, func() {
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			cmd.Result = &models.User{Id: TestUserID}
			return nil
		})

		adminLogoutUserScenario(t, "Should not be allowed when calling POST on",
			"/api/admin/users/1/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 400)
			})
	})

	Convey("When a server admin attempts to logout a non-existing user from all devices", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			userId = cmd.Id
			return models.ErrUserNotFound
		})

		adminLogoutUserScenario(t, "Should return not found when calling POST on", "/api/admin/users/200/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
			So(userId, ShouldEqual, 200)
		})
	})

	Convey("When a server admin attempts to revoke an auth token for a non-existing user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			userId = cmd.Id
			return models.ErrUserNotFound
		})

		cmd := models.RevokeAuthTokenCmd{AuthTokenId: 2}

		adminRevokeUserAuthTokenScenario(t, "Should return not found when calling POST on",
			"/api/admin/users/200/revoke-auth-token", "/api/admin/users/:id/revoke-auth-token", cmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 404)
				So(userId, ShouldEqual, 200)
			})
	})

	Convey("When a server admin gets auth tokens for a non-existing user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetUserByIdQuery) error {
			userId = cmd.Id
			return models.ErrUserNotFound
		})

		adminGetUserAuthTokensScenario(t, "Should return not found when calling GET on",
			"/api/admin/users/200/auth-tokens", "/api/admin/users/:id/auth-tokens", func(sc *scenarioContext) {
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 404)
				So(userId, ShouldEqual, 200)
			})
	})

	Convey("When a server admin attempts to enable/disable a nonexistent user", t, func() {
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

				So(sc.resp.Code, ShouldEqual, 404)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)

				So(respJSON.Get("message").MustString(), ShouldEqual, "user not found")

				So(userId, ShouldEqual, 42)
				So(isDisabled, ShouldEqual, false)
			})

		adminDisableUserScenario(t, "Should return user not found on a POST request", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()

				So(sc.resp.Code, ShouldEqual, 404)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)

				So(respJSON.Get("message").MustString(), ShouldEqual, "user not found")

				So(userId, ShouldEqual, 42)
				So(isDisabled, ShouldEqual, true)
			})
	})

	Convey("When a server admin attempts to disable/enable external user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *models.GetAuthInfoQuery) error {
			userId = cmd.UserId
			return nil
		})

		adminDisableUserScenario(t, "Should return Could not disable external user error", "disable",
			"/api/admin/users/42/disable", "/api/admin/users/:id/disable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 500)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(respJSON.Get("message").MustString(), ShouldEqual, "Could not disable external user")

				So(userId, ShouldEqual, 42)
			})

		adminDisableUserScenario(t, "Should return Could not enable external user error", "enable",
			"/api/admin/users/42/enable", "/api/admin/users/:id/enable", func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 500)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(respJSON.Get("message").MustString(), ShouldEqual, "Could not enable external user")

				So(userId, ShouldEqual, 42)
			})
	})

	Convey("When a server admin attempts to delete a nonexistent user", t, func() {
		var userId int64
		bus.AddHandler("test", func(cmd *models.DeleteUserCommand) error {
			userId = cmd.UserId
			return models.ErrUserNotFound
		})

		adminDeleteUserScenario(t, "Should return user not found error", "/api/admin/users/42",
			"/api/admin/users/:id", func(sc *scenarioContext) {
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

				So(sc.resp.Code, ShouldEqual, 404)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(respJSON.Get("message").MustString(), ShouldEqual, "user not found")

				So(userId, ShouldEqual, 42)
			})
	})

	Convey("When a server admin attempts to create a user", t, func() {
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

		Convey("Without an organization", func() {
			createCmd := dtos.AdminCreateUserForm{
				Login:    TestLogin,
				Password: TestPassword,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 200)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(respJSON.Get("id").MustInt64(), ShouldEqual, TestUserID)
				So(respJSON.Get("message").MustString(), ShouldEqual, "User created")

				// test that userLogin and orgId were transmitted correctly to the handler
				So(userLogin, ShouldEqual, TestLogin)
				So(orgId, ShouldEqual, 0)
			})
		})

		Convey("With an organization", func() {
			createCmd := dtos.AdminCreateUserForm{
				Login:    TestLogin,
				Password: TestPassword,
				OrgId:    TestOrgID,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 200)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(respJSON.Get("id").MustInt64(), ShouldEqual, TestUserID)
				So(respJSON.Get("message").MustString(), ShouldEqual, "User created")

				So(userLogin, ShouldEqual, TestLogin)
				So(orgId, ShouldEqual, TestOrgID)
			})
		})

		Convey("With a nonexistent organization", func() {
			createCmd := dtos.AdminCreateUserForm{
				Login:    TestLogin,
				Password: TestPassword,
				OrgId:    nonExistingOrgID,
			}

			adminCreateUserScenario(t, "Should create the user", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
				sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 400)

				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(respJSON.Get("message").MustString(), ShouldEqual, "organization not found")

				So(userLogin, ShouldEqual, TestLogin)
				So(orgId, ShouldEqual, 1000)
			})
		})
	})

	Convey("When a server admin attempts to create a user with an already existing email/login", t, func() {
		bus.AddHandler("test", func(cmd *models.CreateUserCommand) error {
			return models.ErrUserAlreadyExists
		})

		createCmd := dtos.AdminCreateUserForm{
			Login:    TestLogin,
			Password: TestPassword,
		}

		adminCreateUserScenario(t, "Should return an error", "/api/admin/users", "/api/admin/users", createCmd, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 412)

			respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
			So(err, ShouldBeNil)
			So(respJSON.Get("error").MustString(), ShouldEqual, "user already exists")
		})
	})
}

func putAdminScenario(t *testing.T, desc string, url string, routePattern string, role models.RoleType, cmd dtos.AdminUpdateUserPermissionsForm, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
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
	Convey(desc+" "+url, func() {
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
	Convey(desc+" "+url, func() {
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
	Convey(desc+" "+url, func() {
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
	Convey(desc+" "+url, func() {
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
	Convey(desc+" "+url, func() {
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
	Convey(desc+" "+url, func() {
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
