package middleware

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"

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

		Convey("Anonymous auth enabled", func() {
			origEnabled := setting.AnonymousEnabled
			t.Cleanup(func() {
				setting.AnonymousEnabled = origEnabled
			})
			origName := setting.AnonymousOrgName
			t.Cleanup(func() {
				setting.AnonymousOrgName = origName
			})
			setting.AnonymousEnabled = true
			setting.AnonymousOrgName = "test"

			bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
				query.Result = &models.Org{Id: 1, Name: "test"}
				return nil
			})

			middlewareScenario(t, "ReqSignIn true and request with forceLogin in query string", func(sc *scenarioContext) {
				sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

				sc.fakeReq("GET", "/secure?forceLogin=true").exec()

				Convey("Should redirect to login", func() {
					So(sc.resp.Code, ShouldEqual, 302)
					location, ok := sc.resp.Header()["Location"]
					So(ok, ShouldBeTrue)
					So(location[0], ShouldEqual, "/login")
				})
			})

			middlewareScenario(t, "ReqSignIn true and request with same org provided in query string", func(sc *scenarioContext) {
				sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

				sc.fakeReq("GET", "/secure?orgId=1").exec()

				Convey("Should not redirect to login", func() {
					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			middlewareScenario(t, "ReqSignIn true and request with different org provided in query string", func(sc *scenarioContext) {
				sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

				sc.fakeReq("GET", "/secure?orgId=2").exec()

				Convey("Should redirect to login", func() {
					So(sc.resp.Code, ShouldEqual, 302)
					location, ok := sc.resp.Header()["Location"]
					So(ok, ShouldBeTrue)
					So(location[0], ShouldEqual, "/login")
				})
			})
		})

		Convey("snapshot public mode or signed in", func() {
			middlewareScenario(t, "Snapshot public mode disabled and unauthenticated request should return 401", func(sc *scenarioContext) {
				sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(), sc.defaultHandler)
				sc.fakeReq("GET", "/api/snapshot").exec()
				So(sc.resp.Code, ShouldEqual, 401)
			})

			middlewareScenario(t, "Snapshot public mode enabled and unauthenticated request should return 200", func(sc *scenarioContext) {
				setting.SnapshotPublicMode = true
				sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(), sc.defaultHandler)
				sc.fakeReq("GET", "/api/snapshot").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})
	})
}

func TestRemoveForceLoginparams(t *testing.T) {
	tcs := []struct {
		inp string
		exp string
	}{
		{inp: "/?forceLogin=true", exp: "/?"},
		{inp: "/d/dash/dash-title?ordId=1&forceLogin=true", exp: "/d/dash/dash-title?ordId=1"},
		{inp: "/?kiosk&forceLogin=true", exp: "/?kiosk"},
		{inp: "/d/dash/dash-title?ordId=1&kiosk&forceLogin=true", exp: "/d/dash/dash-title?ordId=1&kiosk"},
		{inp: "/d/dash/dash-title?ordId=1&forceLogin=true&kiosk", exp: "/d/dash/dash-title?ordId=1&kiosk"},
		{inp: "/d/dash/dash-title?forceLogin=true&kiosk", exp: "/d/dash/dash-title?&kiosk"},
	}
	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			require.Equal(t, tc.exp, removeForceLoginParams(tc.inp))
		})
	}
}
