package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAdminApiEndpoint(t *testing.T) {
	role := m.ROLE_ADMIN
	Convey("Given a server admin attempts to remove themself as an admin", t, func() {

		updateCmd := dtos.AdminUpdateUserPermissionsForm{
			IsGrafanaAdmin: false,
		}

		bus.AddHandler("test", func(cmd *m.UpdateUserPermissionsCommand) error {
			return m.ErrLastGrafanaAdmin
		})

		putAdminScenario("When calling PUT on", "/api/admin/users/1/permissions", "/api/admin/users/:id/permissions", role, updateCmd, func(sc *scenarioContext) {
			sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 400)
		})
	})

	Convey("When a server admin attempts to logout himself from all devices", t, func() {
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			cmd.Result = &m.User{Id: TestUserID}
			return nil
		})

		adminLogoutUserScenario("Should not be allowed when calling POST on", "/api/admin/users/1/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 400)
		})
	})

	Convey("When a server admin attempts to logout a non-existing user from all devices", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			userId = cmd.Id
			return m.ErrUserNotFound
		})

		adminLogoutUserScenario("Should return not found when calling POST on", "/api/admin/users/200/logout", "/api/admin/users/:id/logout", func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
			So(userId, ShouldEqual, 200)
		})
	})

	Convey("When a server admin attempts to revoke an auth token for a non-existing user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			userId = cmd.Id
			return m.ErrUserNotFound
		})

		cmd := m.RevokeAuthTokenCmd{AuthTokenId: 2}

		adminRevokeUserAuthTokenScenario("Should return not found when calling POST on", "/api/admin/users/200/revoke-auth-token", "/api/admin/users/:id/revoke-auth-token", cmd, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
			So(userId, ShouldEqual, 200)
		})
	})

	Convey("When a server admin gets auth tokens for a non-existing user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			userId = cmd.Id
			return m.ErrUserNotFound
		})

		adminGetUserAuthTokensScenario("Should return not found when calling GET on", "/api/admin/users/200/auth-tokens", "/api/admin/users/:id/auth-tokens", func(sc *scenarioContext) {
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
			So(userId, ShouldEqual, 200)
		})
	})
}

func putAdminScenario(desc string, url string, routePattern string, role m.RoleType, cmd dtos.AdminUpdateUserPermissionsForm, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *m.ReqContext) {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			AdminUpdateUserPermissions(c, cmd)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminLogoutUserScenario(desc string, url string, routePattern string, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: auth.NewFakeUserAuthTokenService(),
		}

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN

			return hs.AdminLogoutUser(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminRevokeUserAuthTokenScenario(desc string, url string, routePattern string, cmd m.RevokeAuthTokenCmd, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN

			return hs.AdminRevokeUserAuthToken(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func adminGetUserAuthTokensScenario(desc string, url string, routePattern string, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext(url)
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN

			return hs.AdminGetUserAuthTokens(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
