package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"
	. "github.com/smartystreets/goconvey/convey"
)

type scenarioContext struct {
	m       *macaron.Macaron
	context *Context
	resp    *httptest.ResponseRecorder
}

func (sc *scenarioContext) PerformGet(url string) {
	req, err := http.NewRequest("GET", "/", nil)
	So(err, ShouldBeNil)
	sc.m.ServeHTTP(sc.resp, req)
}

type scenarioFunc func(c *scenarioContext)

func middlewareScenario(desc string, fn scenarioFunc) {
	sc := &scenarioContext{}

	sc.m = macaron.New()
	sc.m.Use(GetContextHandler())
	// mock out gc goroutine
	startSessionGC = func() {}
	sc.m.Use(Sessioner(&session.Options{}))

	sc.m.Get("/", func(c *Context) {
		sc.context = c
	})

	sc.resp = httptest.NewRecorder()
	fn(sc)
}

func TestMiddlewareContext(t *testing.T) {

	Convey("Given grafana context", t, func() {
		middlewareScenario("middleware should add context to injector", func(sc *scenarioContext) {
			sc.PerformGet("/")
			So(sc.context, ShouldNotBeNil)
		})

		middlewareScenario("Default middleware should allow get request", func(sc *scenarioContext) {
			sc.PerformGet("/")
			So(sc.resp.Code, ShouldEqual, 200)
		})

	})
}
