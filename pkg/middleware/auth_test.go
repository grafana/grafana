package middleware

import (
	"testing"

	"github.com/casbin/casbin"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareAuth(t *testing.T) {

	Convey("Given the grafana middleware", t, func() {
		reqSignIn := Auth(&AuthOptions{ReqSignedIn: true})

		middlewareScenario("ReqSignIn true and unauthenticated request", func(sc *scenarioContext) {
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			e := casbin.NewEnforcer("../../conf/policy/authz_model.conf")
			e.AddPolicy("is", "org_viewer", "/*", "*", "allow")
			sc.m.Use(Authorizer(e))

			sc.fakeReq("GET", "/secure").exec()

			Convey("Should redirect to login", func() {
				So(sc.resp.Code, ShouldEqual, 302)
			})
		})

		middlewareScenario("ReqSignIn true and unauthenticated API request", func(sc *scenarioContext) {
			sc.m.Get("/api/secure", reqSignIn, sc.defaultHandler)

			e := casbin.NewEnforcer("../../conf/policy/authz_model.conf")
			e.AddPolicy("is", "org_viewer", "/*", "*", "allow")
			sc.m.Use(Authorizer(e))

			sc.fakeReq("GET", "/api/secure").exec()

			Convey("Should return 401", func() {
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

	})
}
