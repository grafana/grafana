package api

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"

	. "github.com/smartystreets/goconvey/convey"
)

func loggedInUserScenario(desc string, url string, fn scenarioFunc) {
	loggedInUserScenarioWithRole(desc, "GET", url, url, m.ROLE_EDITOR, fn)
}

func loggedInUserScenarioWithRole(desc string, method string, url string, routePattern string, role m.RoleType, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role
			if sc.handlerFunc != nil {
				return sc.handlerFunc(sc.context)
			}

			return nil
		})

		switch method {
		case "GET":
			sc.m.Get(routePattern, sc.defaultHandler)
		case "DELETE":
			sc.m.Delete(routePattern, sc.defaultHandler)
		}

		fn(sc)
	})
}

func anonymousUserScenario(desc string, method string, url string, routePattern string, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *m.ReqContext) Response {
			sc.context = c
			if sc.handlerFunc != nil {
				return sc.handlerFunc(sc.context)
			}

			return nil
		})

		switch method {
		case "GET":
			sc.m.Get(routePattern, sc.defaultHandler)
		case "DELETE":
			sc.m.Delete(routePattern, sc.defaultHandler)
		}

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
	m                    *macaron.Macaron
	context              *m.ReqContext
	resp                 *httptest.ResponseRecorder
	handlerFunc          handlerFunc
	defaultHandler       macaron.Handler
	req                  *http.Request
	url                  string
	userAuthTokenService *fakeUserAuthTokenService
}

func (sc *scenarioContext) exec() {
	sc.m.ServeHTTP(sc.resp, sc.req)
}

type scenarioFunc func(c *scenarioContext)
type handlerFunc func(c *m.ReqContext) Response

func setupScenarioContext(url string) *scenarioContext {
	sc := &scenarioContext{
		url: url,
	}
	viewsPath, _ := filepath.Abs("../../public/views")

	sc.m = macaron.New()
	sc.m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory: viewsPath,
		Delims:    macaron.Delims{Left: "[[", Right: "]]"},
	}))

	sc.userAuthTokenService = newFakeUserAuthTokenService()
	sc.m.Use(middleware.GetContextHandler(sc.userAuthTokenService))

	return sc
}

type fakeUserAuthTokenService struct {
	initContextWithTokenProvider func(ctx *m.ReqContext, orgID int64) bool
}

func newFakeUserAuthTokenService() *fakeUserAuthTokenService {
	return &fakeUserAuthTokenService{
		initContextWithTokenProvider: func(ctx *m.ReqContext, orgID int64) bool {
			return false
		},
	}
}

func (s *fakeUserAuthTokenService) InitContextWithToken(ctx *m.ReqContext, orgID int64) bool {
	return s.initContextWithTokenProvider(ctx, orgID)
}

func (s *fakeUserAuthTokenService) UserAuthenticatedHook(user *m.User, c *m.ReqContext) error {
	return nil
}

func (s *fakeUserAuthTokenService) UserSignedOutHook(c *m.ReqContext) {}
