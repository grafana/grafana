package middleware

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	macaron "gopkg.in/macaron.v1"
)

func TestRecoveryMiddleware(t *testing.T) {
	setting.ERR_TEMPLATE_NAME = "error-template"

	Convey("Given an api route that panics", t, func() {
		apiURL := "/api/whatever"
		recoveryScenario(t, "recovery middleware should return json", apiURL, func(sc *scenarioContext) {
			sc.handlerFunc = PanicHandler
			sc.fakeReq("GET", apiURL).exec()
			sc.req.Header.Add("content-type", "application/json")

			So(sc.resp.Code, ShouldEqual, 500)
			So(sc.respJson["message"], ShouldStartWith, "Internal Server Error - Check the Grafana server logs for the detailed error message.")
			So(sc.respJson["error"], ShouldStartWith, "Server Error")
		})
	})

	Convey("Given a non-api route that panics", t, func() {
		apiURL := "/whatever"
		recoveryScenario(t, "recovery middleware should return html", apiURL, func(sc *scenarioContext) {
			sc.handlerFunc = PanicHandler
			sc.fakeReq("GET", apiURL).exec()

			So(sc.resp.Code, ShouldEqual, 500)
			So(sc.resp.Header().Get("content-type"), ShouldEqual, "text/html; charset=UTF-8")
			So(sc.resp.Body.String(), ShouldContainSubstring, "<title>Grafana - Error</title>")
		})
	})
}

func PanicHandler(c *models.ReqContext) {
	panic("Handler has panicked")
}

func recoveryScenario(t *testing.T, desc string, url string, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			url: url,
		}

		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(Recovery())

		sc.m.Use(AddDefaultResponseHeaders())
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.userAuthTokenService = auth.NewFakeUserAuthTokenService()
		sc.remoteCacheService = remotecache.NewFakeStore(t)

		sc.m.Use(GetContextHandler(sc.userAuthTokenService, sc.remoteCacheService, nil))
		// mock out gc goroutine
		sc.m.Use(OrgRedirect())

		sc.defaultHandler = func(c *models.ReqContext) {
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
			}
		}

		sc.m.Get(url, sc.defaultHandler)

		fn(sc)
	})
}
