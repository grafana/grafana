package middleware

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareDashboardRedirect(t *testing.T) {
	Convey("Given the dashboard redirect middleware", t, func() {
		bus.ClearBusHandlers()
		redirectFromLegacyDashboardUrl := RedirectFromLegacyDashboardUrl()
		redirectFromLegacyDashboardSoloUrl := RedirectFromLegacyDashboardSoloUrl()

		fakeDash := m.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		middlewareScenario("GET dashboard by legacy url", func(sc *scenarioContext) {
			sc.m.Get("/dashboard/db/:slug", redirectFromLegacyDashboardUrl, sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/dashboard/db/dash", map[string]string{}).exec()

			Convey("Should redirect to new dashboard url with a 301 Moved Permanently", func() {
				So(sc.resp.Code, ShouldEqual, 301)
				redirectUrl, _ := sc.resp.Result().Location()
				So(redirectUrl.Path, ShouldEqual, m.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug))
			})
		})

		middlewareScenario("GET dashboard solo by legacy url", func(sc *scenarioContext) {
			sc.m.Get("/dashboard-solo/db/:slug", redirectFromLegacyDashboardSoloUrl, sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/dashboard-solo/db/dash", map[string]string{}).exec()

			Convey("Should redirect to new dashboard url with a 301 Moved Permanently", func() {
				So(sc.resp.Code, ShouldEqual, 301)
				redirectUrl, _ := sc.resp.Result().Location()
				expectedUrl := m.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug)
				expectedUrl = strings.Replace(expectedUrl, "/d/", "/d-solo/", 1)
				So(redirectUrl.Path, ShouldEqual, expectedUrl)
			})
		})
	})
}
