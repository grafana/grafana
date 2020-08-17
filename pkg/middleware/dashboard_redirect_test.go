package middleware

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareDashboardRedirect(t *testing.T) {
	Convey("Given the dashboard redirect middleware", t, func() {
		bus.ClearBusHandlers()
		redirectFromLegacyDashboardUrl := RedirectFromLegacyDashboardURL()
		redirectFromLegacyDashboardSoloUrl := RedirectFromLegacyDashboardSoloURL()

		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false
		fakeDash.Uid = util.GenerateShortUID()

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		middlewareScenario(t, "GET dashboard by legacy url", func(sc *scenarioContext) {
			sc.m.Get("/dashboard/db/:slug", redirectFromLegacyDashboardUrl, sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/dashboard/db/dash?orgId=1&panelId=2", map[string]string{}).exec()

			Convey("Should redirect to new dashboard url with a 301 Moved Permanently", func() {
				So(sc.resp.Code, ShouldEqual, 301)
				resp := sc.resp.Result()
				defer resp.Body.Close()
				redirectURL, err := resp.Location()
				So(err, ShouldBeNil)
				So(redirectURL.Path, ShouldEqual, models.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug))
				So(len(redirectURL.Query()), ShouldEqual, 2)
			})
		})

		middlewareScenario(t, "GET dashboard solo by legacy url", func(sc *scenarioContext) {
			sc.m.Get("/dashboard-solo/db/:slug", redirectFromLegacyDashboardSoloUrl, sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/dashboard-solo/db/dash?orgId=1&panelId=2", map[string]string{}).exec()

			Convey("Should redirect to new dashboard url with a 301 Moved Permanently", func() {
				So(sc.resp.Code, ShouldEqual, 301)
				resp := sc.resp.Result()
				defer resp.Body.Close()
				redirectURL, err := resp.Location()
				So(err, ShouldBeNil)
				expectedURL := models.GetDashboardUrl(fakeDash.Uid, fakeDash.Slug)
				expectedURL = strings.Replace(expectedURL, "/d/", "/d-solo/", 1)
				So(redirectURL.Path, ShouldEqual, expectedURL)
				So(len(redirectURL.Query()), ShouldEqual, 2)
			})
		})
	})

	Convey("Given the dashboard legacy edit panel middleware", t, func() {
		bus.ClearBusHandlers()

		middlewareScenario(t, "GET dashboard by legacy edit url", func(sc *scenarioContext) {
			sc.m.Get("/d/:uid/:slug", RedirectFromLegacyPanelEditURL(), sc.defaultHandler)

			sc.fakeReqWithParams("GET", "/d/asd/dash?orgId=1&panelId=12&fullscreen&edit", map[string]string{}).exec()

			Convey("Should redirect to new dashboard edit url with a 301 Moved Permanently", func() {
				So(sc.resp.Code, ShouldEqual, 301)
				resp := sc.resp.Result()
				defer resp.Body.Close()
				redirectURL, err := resp.Location()
				So(err, ShouldBeNil)
				So(redirectURL.String(), ShouldEqual, "/d/asd/d/asd/dash?editPanel=12&orgId=1")
			})
		})
	})
}
