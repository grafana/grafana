package middleware

import (
	"encoding/json"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/bus"
	authLogin "github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestMiddlewareBasicAuth(t *testing.T) {
	Convey("Given the basic auth", t, func() {
		var oldBasicAuthEnabled = setting.BasicAuthEnabled
		var oldDisableBruteForceLoginProtection = setting.DisableBruteForceLoginProtection
		var id int64 = 12

		Convey("Setup", func() {
			setting.BasicAuthEnabled = true
			setting.DisableBruteForceLoginProtection = true
			bus.ClearBusHandlers()
		})

		middlewareScenario(t, "Valid API key", func(sc *scenarioContext) {
			var orgID int64 = 2
			keyhash, err := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")
			So(err, ShouldBeNil)

			bus.AddHandler("test", func(query *models.GetApiKeyByNameQuery) error {
				query.Result = &models.ApiKey{OrgId: orgID, Role: models.ROLE_EDITOR, Key: keyhash}
				return nil
			})

			authHeader := util.GetBasicAuthHeader("api_key", "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9")
			sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

			Convey("Should return 200", func() {
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("Should init middleware context", func() {
				So(sc.context.IsSignedIn, ShouldEqual, true)
				So(sc.context.OrgId, ShouldEqual, orgID)
				So(sc.context.OrgRole, ShouldEqual, models.ROLE_EDITOR)
			})
		})

		middlewareScenario(t, "Handle auth", func(sc *scenarioContext) {
			var password = "MyPass"
			var salt = "Salt"
			var orgID int64 = 2

			bus.AddHandler("grafana-auth", func(query *models.LoginUserQuery) error {
				encoded, err := util.EncodePassword(password, salt)
				if err != nil {
					return err
				}
				query.User = &models.User{
					Password: encoded,
					Salt:     salt,
				}
				return nil
			})

			bus.AddHandler("get-sign-user", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: orgID, UserId: id}
				return nil
			})

			authHeader := util.GetBasicAuthHeader("myUser", password)
			sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

			Convey("Should init middleware context with users", func() {
				So(sc.context.IsSignedIn, ShouldEqual, true)
				So(sc.context.OrgId, ShouldEqual, orgID)
				So(sc.context.UserId, ShouldEqual, id)
			})

			bus.ClearBusHandlers()
		})

		middlewareScenario(t, "Auth sequence", func(sc *scenarioContext) {
			var password = "MyPass"
			var salt = "Salt"

			authLogin.Init()

			bus.AddHandler("user-query", func(query *models.GetUserByLoginQuery) error {
				encoded, err := util.EncodePassword(password, salt)
				if err != nil {
					return err
				}
				query.Result = &models.User{
					Password: encoded,
					Id:       id,
					Salt:     salt,
				}
				return nil
			})

			bus.AddHandler("get-sign-user", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{UserId: query.UserId}
				return nil
			})

			authHeader := util.GetBasicAuthHeader("myUser", password)
			sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

			Convey("Should init middleware context with user", func() {
				So(sc.context.IsSignedIn, ShouldEqual, true)
				So(sc.context.UserId, ShouldEqual, id)
			})
		})

		middlewareScenario(t, "Should return error if user is not found", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/")
			sc.req.SetBasicAuth("user", "password")
			sc.exec()

			err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
			So(err, ShouldNotBeNil)

			So(sc.resp.Code, ShouldEqual, 401)
			So(sc.respJson["message"], ShouldEqual, errStringInvalidUsernamePassword)
		})

		middlewareScenario(t, "Should return error if user & password do not match", func(sc *scenarioContext) {
			bus.AddHandler("user-query", func(loginUserQuery *models.GetUserByLoginQuery) error {
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.SetBasicAuth("killa", "gorilla")
			sc.exec()

			err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
			So(err, ShouldNotBeNil)

			So(sc.resp.Code, ShouldEqual, 401)
			So(sc.respJson["message"], ShouldEqual, errStringInvalidUsernamePassword)
		})

		Convey("Destroy", func() {
			setting.BasicAuthEnabled = oldBasicAuthEnabled
			setting.DisableBruteForceLoginProtection = oldDisableBruteForceLoginProtection
		})
	})
}
