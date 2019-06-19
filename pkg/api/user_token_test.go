package api

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUserTokenApiEndpoint(t *testing.T) {
	Convey("When current user attempts to revoke an auth token for a non-existing user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			userId = cmd.Id
			return m.ErrUserNotFound
		})

		cmd := m.RevokeAuthTokenCmd{AuthTokenId: 2}

		revokeUserAuthTokenScenario("Should return not found when calling POST on", "/api/user/revoke-auth-token", "/api/user/revoke-auth-token", cmd, 200, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
			So(userId, ShouldEqual, 200)
		})
	})

	Convey("When current user gets auth tokens for a non-existing user", t, func() {
		userId := int64(0)
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			userId = cmd.Id
			return m.ErrUserNotFound
		})

		getUserAuthTokensScenario("Should return not found when calling GET on", "/api/user/auth-tokens", "/api/user/auth-tokens", 200, func(sc *scenarioContext) {
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
			So(userId, ShouldEqual, 200)
		})
	})

	Convey("When logout an existing user from all devices", t, func() {
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			cmd.Result = &m.User{Id: 200}
			return nil
		})

		logoutUserFromAllDevicesInternalScenario("Should be successful", 1, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 200)
		})
	})

	Convey("When logout a non-existing user from all devices", t, func() {
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			return m.ErrUserNotFound
		})

		logoutUserFromAllDevicesInternalScenario("Should return not found", TestUserID, func(sc *scenarioContext) {
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 404)
		})
	})

	Convey("When revoke an auth token for a user", t, func() {
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			cmd.Result = &m.User{Id: 200}
			return nil
		})

		cmd := m.RevokeAuthTokenCmd{AuthTokenId: 2}
		token := &m.UserToken{Id: 1}

		revokeUserAuthTokenInternalScenario("Should be successful", cmd, 200, token, func(sc *scenarioContext) {
			sc.userAuthTokenService.GetUserTokenProvider = func(ctx context.Context, userId, userTokenId int64) (*m.UserToken, error) {
				return &m.UserToken{Id: 2}, nil
			}
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 200)
		})
	})

	Convey("When revoke the active auth token used by himself", t, func() {
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			cmd.Result = &m.User{Id: TestUserID}
			return nil
		})

		cmd := m.RevokeAuthTokenCmd{AuthTokenId: 2}
		token := &m.UserToken{Id: 2}

		revokeUserAuthTokenInternalScenario("Should not be successful", cmd, TestUserID, token, func(sc *scenarioContext) {
			sc.userAuthTokenService.GetUserTokenProvider = func(ctx context.Context, userId, userTokenId int64) (*m.UserToken, error) {
				return token, nil
			}
			sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 400)
		})
	})

	Convey("When gets auth tokens for a user", t, func() {
		bus.AddHandler("test", func(cmd *m.GetUserByIdQuery) error {
			cmd.Result = &m.User{Id: TestUserID}
			return nil
		})

		currentToken := &m.UserToken{Id: 1}

		getUserAuthTokensInternalScenario("Should be successful", currentToken, func(sc *scenarioContext) {
			tokens := []*m.UserToken{
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
					SeenAt:    time.Now().Unix(),
				},
			}
			sc.userAuthTokenService.GetUserTokensProvider = func(ctx context.Context, userId int64) ([]*m.UserToken, error) {
				return tokens, nil
			}
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			So(sc.resp.Code, ShouldEqual, 200)
			result := sc.ToJSON()
			So(result.MustArray(), ShouldHaveLength, 2)

			resultOne := result.GetIndex(0)
			So(resultOne.Get("id").MustInt64(), ShouldEqual, tokens[0].Id)
			So(resultOne.Get("isActive").MustBool(), ShouldBeTrue)
			So(resultOne.Get("clientIp").MustString(), ShouldEqual, "127.0.0.1")
			So(resultOne.Get("createdAt").MustString(), ShouldEqual, time.Unix(tokens[0].CreatedAt, 0).Format(time.RFC3339))
			So(resultOne.Get("seenAt").MustString(), ShouldEqual, time.Unix(tokens[0].SeenAt, 0).Format(time.RFC3339))

			So(resultOne.Get("device").MustString(), ShouldEqual, "Other")
			So(resultOne.Get("browser").MustString(), ShouldEqual, "Chrome")
			So(resultOne.Get("browserVersion").MustString(), ShouldEqual, "72.0")
			So(resultOne.Get("os").MustString(), ShouldEqual, "Linux")
			So(resultOne.Get("osVersion").MustString(), ShouldEqual, "")

			resultTwo := result.GetIndex(1)
			So(resultTwo.Get("id").MustInt64(), ShouldEqual, tokens[1].Id)
			So(resultTwo.Get("isActive").MustBool(), ShouldBeFalse)
			So(resultTwo.Get("clientIp").MustString(), ShouldEqual, "127.0.0.2")
			So(resultTwo.Get("createdAt").MustString(), ShouldEqual, time.Unix(tokens[1].CreatedAt, 0).Format(time.RFC3339))
			So(resultTwo.Get("seenAt").MustString(), ShouldEqual, time.Unix(tokens[1].SeenAt, 0).Format(time.RFC3339))

			So(resultTwo.Get("device").MustString(), ShouldEqual, "iPhone")
			So(resultTwo.Get("browser").MustString(), ShouldEqual, "Mobile Safari")
			So(resultTwo.Get("browserVersion").MustString(), ShouldEqual, "11.0")
			So(resultTwo.Get("os").MustString(), ShouldEqual, "iOS")
			So(resultTwo.Get("osVersion").MustString(), ShouldEqual, "11.0")
		})
	})
}

func revokeUserAuthTokenScenario(desc string, url string, routePattern string, cmd m.RevokeAuthTokenCmd, userId int64, fn scenarioFunc) {
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
			sc.context.UserId = userId
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN

			return hs.RevokeUserAuthToken(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func getUserAuthTokensScenario(desc string, url string, routePattern string, userId int64, fn scenarioFunc) {
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
			sc.context.UserId = userId
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN

			return hs.GetUserAuthTokens(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func logoutUserFromAllDevicesInternalScenario(desc string, userId int64, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: auth.NewFakeUserAuthTokenService(),
		}

		sc := setupScenarioContext("/")
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN

			return hs.logoutUserFromAllDevicesInternal(context.Background(), userId)
		})

		sc.m.Post("/", sc.defaultHandler)

		fn(sc)
	})
}

func revokeUserAuthTokenInternalScenario(desc string, cmd m.RevokeAuthTokenCmd, userId int64, token *m.UserToken, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext("/")
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN
			sc.context.UserToken = token

			return hs.revokeUserAuthTokenInternal(c, userId, cmd)
		})

		sc.m.Post("/", sc.defaultHandler)

		fn(sc)
	})
}

func getUserAuthTokensInternalScenario(desc string, token *m.UserToken, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()

		hs := HTTPServer{
			Bus:              bus.GetBus(),
			AuthTokenService: fakeAuthTokenService,
		}

		sc := setupScenarioContext("/")
		sc.userAuthTokenService = fakeAuthTokenService
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = m.ROLE_ADMIN
			sc.context.UserToken = token

			return hs.getUserAuthTokensInternal(c, TestUserID)
		})

		sc.m.Get("/", sc.defaultHandler)

		fn(sc)
	})
}
