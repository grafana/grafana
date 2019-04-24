package middleware

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareAuth(t *testing.T) {

	Convey("Given the grafana middleware", t, func() {
		reqSignIn := Auth(&AuthOptions{ReqSignedIn: true})

		middlewareScenario(t, "ReqSignIn true and unauthenticated request", func(sc *scenarioContext) {
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure").exec()

			Convey("Should redirect to login", func() {
				So(sc.resp.Code, ShouldEqual, 302)
			})
		})

		middlewareScenario(t, "ReqSignIn true and unauthenticated API request", func(sc *scenarioContext) {
			sc.m.Get("/api/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/api/secure").exec()

			Convey("Should return 401", func() {
				So(sc.resp.Code, ShouldEqual, 401)
			})
		})

	})
}
