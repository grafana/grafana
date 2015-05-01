package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/Unknwon/macaron"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/macaron-contrib/session"
	. "github.com/smartystreets/goconvey/convey"
)

type scenarioContext struct {
	m        *macaron.Macaron
	context  *Context
	resp     *httptest.ResponseRecorder
	apiKey   string
	respJson map[string]interface{}
}

func (sc *scenarioContext) PerformGet(url string) {
	req, err := http.NewRequest("GET", "/", nil)
	So(err, ShouldBeNil)
	if sc.apiKey != "" {
		req.Header.Add("Authorization", "Bearer "+sc.apiKey)
	}
	sc.m.ServeHTTP(sc.resp, req)

	if sc.resp.Header().Get("Content-Type") == "application/json; charset=UTF-8" {
		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		So(err, ShouldBeNil)
	}
}

type scenarioFunc func(c *scenarioContext)
type reqModifier func(c *http.Request)

func middlewareScenario(desc string, fn scenarioFunc) {
	Convey(desc, func() {
		sc := &scenarioContext{}
		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(GetContextHandler())
		// mock out gc goroutine
		startSessionGC = func() {}
		sc.m.Use(Sessioner(&session.Options{}))

		sc.m.Get("/", func(c *Context) {
			sc.context = c
		})

		sc.resp = httptest.NewRecorder()
		fn(sc)
	})
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

		middlewareScenario("Non api request should init session", func(sc *scenarioContext) {
			sc.PerformGet("/")
			So(sc.resp.Header().Get("Set-Cookie"), ShouldContainSubstring, "grafana_sess")
		})

		middlewareScenario("Invalid api key", func(sc *scenarioContext) {
			sc.apiKey = "invalid_key_test"
			sc.PerformGet("/")

			Convey("Should not init session", func() {
				So(sc.resp.Header().Get("Set-Cookie"), ShouldBeEmpty)
			})

			Convey("Should return 401", func() {
				So(sc.resp.Code, ShouldEqual, 401)
				So(sc.respJson["message"], ShouldEqual, "Invalid API key")
			})
		})

		middlewareScenario("Valid api key", func(sc *scenarioContext) {
			sc.apiKey = "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9"
			keyhash := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")

			bus.AddHandler("test", func(query *m.GetApiKeyByNameQuery) error {
				query.Result = &m.ApiKey{OrgId: 12, Role: m.ROLE_EDITOR, Key: keyhash}
				return nil
			})

			sc.PerformGet("/")

			Convey("Should return 200", func() {
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("Should init middleware context", func() {
				So(sc.context.OrgId, ShouldEqual, 12)
				So(sc.context.OrgRole, ShouldEqual, m.ROLE_EDITOR)
			})
		})

	})
}
