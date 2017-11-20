package middleware

import (
	"path/filepath"
	"testing"

	"github.com/go-macaron/session"
	"github.com/grafana/grafana/pkg/bus"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

func TestRecoveryMiddleware(t *testing.T) {
	Convey("Given an api route that panics", t, func() {
		apiUrl := "/api/whatever"
		recoveryScenario("recovery middleware should return json", apiUrl, func(sc *scenarioContext) {
			sc.handlerFunc = PanicHandler
			sc.fakeReq("GET", apiUrl).exec()
			sc.req.Header.Add("content-type", "application/json")

			So(sc.resp.Code, ShouldEqual, 500)
			So(sc.respJson["message"], ShouldStartWith, "Internal Server Error - Check the Grafana server logs for the detailed error message.")
			So(sc.respJson["error"], ShouldStartWith, "Server Error")
		})
	})

	Convey("Given a non-api route that panics", t, func() {
		apiUrl := "/whatever"
		recoveryScenario("recovery middleware should return html", apiUrl, func(sc *scenarioContext) {
			sc.handlerFunc = PanicHandler
			sc.fakeReq("GET", apiUrl).exec()

			So(sc.resp.Code, ShouldEqual, 500)
			So(sc.resp.Header().Get("content-type"), ShouldEqual, "text/html; charset=UTF-8")
			So(sc.resp.Body.String(), ShouldContainSubstring, "<title>Grafana - Error</title>")
		})
	})
}

func PanicHandler(c *Context) {
	panic("Handler has panicked")
}

func recoveryScenario(desc string, url string, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			url: url,
		}
		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(Recovery())

		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(GetContextHandler())
		// mock out gc goroutine
		startSessionGC = func() {}
		sc.m.Use(Sessioner(&session.Options{}))
		sc.m.Use(OrgRedirect())
		sc.m.Use(AddDefaultResponseHeaders())

		sc.defaultHandler = func(c *Context) {
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
			}
		}

		sc.m.Get(url, sc.defaultHandler)

		fn(sc)
	})
}
