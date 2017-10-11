package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	macaron "gopkg.in/macaron.v1"

	"github.com/go-macaron/session"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	. "github.com/smartystreets/goconvey/convey"
)

const (
	TestOrgID  = 1
	TestUserID = 1
)

func TestDataSourcesProxy(t *testing.T) {
	Convey("Given a user is logged in", t, func() {
		loggedInUserScenario("When calling GET on", "/api/datasources/", func(sc *scenarioContext) {

			// Stubs the database query
			bus.AddHandler("test", func(query *models.GetDataSourcesQuery) error {
				So(query.OrgId, ShouldEqual, TestOrgID)
				query.Result = []*models.DataSource{
					{Name: "mmm"},
					{Name: "ZZZ"},
					{Name: "BBB"},
					{Name: "aaa"},
				}
				return nil
			})

			// handler func being tested
			sc.handlerFunc = GetDataSources
			sc.fakeReq("GET", "/api/datasources").exec()

			respJSON := []map[string]interface{}{}
			err := json.NewDecoder(sc.resp.Body).Decode(&respJSON)
			So(err, ShouldBeNil)

			Convey("should return list of datasources for org sorted alphabetically and case insensitively", func() {
				So(respJSON[0]["name"], ShouldEqual, "aaa")
				So(respJSON[1]["name"], ShouldEqual, "BBB")
				So(respJSON[2]["name"], ShouldEqual, "mmm")
				So(respJSON[3]["name"], ShouldEqual, "ZZZ")
			})
		})
	})
}

func loggedInUserScenario(desc string, url string, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			url: url,
		}
		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(middleware.GetContextHandler())
		sc.m.Use(middleware.Sessioner(&session.Options{}))

		sc.defaultHandler = wrap(func(c *middleware.Context) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = models.ROLE_EDITOR
			if sc.handlerFunc != nil {
				return sc.handlerFunc(sc.context)
			}

			return nil
		})

		sc.m.Get(url, sc.defaultHandler)

		fn(sc)
	})
}

func (sc *scenarioContext) fakeReq(method, url string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	So(err, ShouldBeNil)
	sc.req = req

	return sc
}

func (sc *scenarioContext) fakeReqWithParams(method, url string, queryParams map[string]string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	q := req.URL.Query()
	for k, v := range queryParams {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()
	So(err, ShouldBeNil)
	sc.req = req

	return sc
}

type scenarioContext struct {
	m              *macaron.Macaron
	context        *middleware.Context
	resp           *httptest.ResponseRecorder
	handlerFunc    handlerFunc
	defaultHandler macaron.Handler
	req            *http.Request
	url            string
}

func (sc *scenarioContext) exec() {
	sc.m.ServeHTTP(sc.resp, sc.req)
}

type scenarioFunc func(c *scenarioContext)
type handlerFunc func(c *middleware.Context) Response
