package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/Unknwon/macaron"
	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
	"github.com/wangy1931/grafana/pkg/util"
	"github.com/macaron-contrib/session"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareContext(t *testing.T) {

	Convey("Given the grafana middleware", t, func() {
		middlewareScenario("middleware should add context to injector", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").exec()
			So(sc.context, ShouldNotBeNil)
		})

		middlewareScenario("Default middleware should allow get request", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").exec()
			So(sc.resp.Code, ShouldEqual, 200)
		})

		middlewareScenario("Non api request should init session", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").exec()
			So(sc.resp.Header().Get("Set-Cookie"), ShouldContainSubstring, "grafana_sess")
		})

		middlewareScenario("Invalid api key", func(sc *scenarioContext) {
			sc.apiKey = "invalid_key_test"
			sc.fakeReq("GET", "/").exec()

			Convey("Should not init session", func() {
				So(sc.resp.Header().Get("Set-Cookie"), ShouldBeEmpty)
			})

			Convey("Should return 401", func() {
				So(sc.resp.Code, ShouldEqual, 401)
				So(sc.respJson["message"], ShouldEqual, "Invalid API key")
			})
		})

		middlewareScenario("Using basic auth", func(sc *scenarioContext) {

			bus.AddHandler("test", func(query *m.GetUserByLoginQuery) error {
				query.Result = &m.User{
					Password: util.EncodePassword("myPass", "salt"),
					Salt:     "salt",
				}
				return nil
			})

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			setting.BasicAuthEnabled = true
			authHeader := util.GetBasicAuthHeader("myUser", "myPass")
			sc.fakeReq("GET", "/").withAuthoriziationHeader(authHeader).exec()

			Convey("Should init middleware context with user", func() {
				So(sc.context.IsSignedIn, ShouldEqual, true)
				So(sc.context.OrgId, ShouldEqual, 2)
				So(sc.context.UserId, ShouldEqual, 12)
			})
		})

		middlewareScenario("Valid api key", func(sc *scenarioContext) {
			keyhash := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")

			bus.AddHandler("test", func(query *m.GetApiKeyByNameQuery) error {
				query.Result = &m.ApiKey{OrgId: 12, Role: m.ROLE_EDITOR, Key: keyhash}
				return nil
			})

			sc.fakeReq("GET", "/").withValidApiKey().exec()

			Convey("Should return 200", func() {
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("Should init middleware context", func() {
				So(sc.context.IsSignedIn, ShouldEqual, true)
				So(sc.context.OrgId, ShouldEqual, 12)
				So(sc.context.OrgRole, ShouldEqual, m.ROLE_EDITOR)
			})
		})

		middlewareScenario("Valid api key, but does not match db hash", func(sc *scenarioContext) {
			keyhash := "something_not_matching"

			bus.AddHandler("test", func(query *m.GetApiKeyByNameQuery) error {
				query.Result = &m.ApiKey{OrgId: 12, Role: m.ROLE_EDITOR, Key: keyhash}
				return nil
			})

			sc.fakeReq("GET", "/").withValidApiKey().exec()

			Convey("Should return api key invalid", func() {
				So(sc.resp.Code, ShouldEqual, 401)
				So(sc.respJson["message"], ShouldEqual, "Invalid API key")
			})
		})

		middlewareScenario("UserId in session", func(sc *scenarioContext) {

			sc.fakeReq("GET", "/").handler(func(c *Context) {
				c.Session.Set(SESS_KEY_USERID, int64(12))
			}).exec()

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			sc.fakeReq("GET", "/").exec()

			Convey("should init context with user info", func() {
				So(sc.context.IsSignedIn, ShouldBeTrue)
				So(sc.context.UserId, ShouldEqual, 12)
			})
		})

		middlewareScenario("When anonymous access is enabled", func(sc *scenarioContext) {
			setting.AnonymousEnabled = true
			setting.AnonymousOrgName = "test"
			setting.AnonymousOrgRole = string(m.ROLE_EDITOR)

			bus.AddHandler("test", func(query *m.GetOrgByNameQuery) error {
				So(query.Name, ShouldEqual, "test")

				query.Result = &m.Org{Id: 2, Name: "test"}
				return nil
			})

			sc.fakeReq("GET", "/").exec()

			Convey("should init context with org info", func() {
				So(sc.context.UserId, ShouldEqual, 0)
				So(sc.context.OrgId, ShouldEqual, 2)
				So(sc.context.OrgRole, ShouldEqual, m.ROLE_EDITOR)
			})

			Convey("context signed in should be false", func() {
				So(sc.context.IsSignedIn, ShouldBeFalse)
			})
		})

		middlewareScenario("When auth_proxy is enabled enabled and user exists", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.exec()

			Convey("should init context with user info", func() {
				So(sc.context.IsSignedIn, ShouldBeTrue)
				So(sc.context.UserId, ShouldEqual, 12)
				So(sc.context.OrgId, ShouldEqual, 2)
			})
		})

		middlewareScenario("When auth_proxy is enabled enabled and user does not exists", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"
			setting.AuthProxyAutoSignUp = true

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				if query.UserId > 0 {
					query.Result = &m.SignedInUser{OrgId: 4, UserId: 33}
					return nil
				} else {
					return m.ErrUserNotFound
				}
			})

			var createUserCmd *m.CreateUserCommand
			bus.AddHandler("test", func(cmd *m.CreateUserCommand) error {
				createUserCmd = cmd
				cmd.Result = m.User{Id: 33}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.exec()

			Convey("Should create user if auto sign up is enabled", func() {
				So(sc.context.IsSignedIn, ShouldBeTrue)
				So(sc.context.UserId, ShouldEqual, 33)
				So(sc.context.OrgId, ShouldEqual, 4)

			})
		})

	})
}

func middlewareScenario(desc string, fn scenarioFunc) {
	Convey(desc, func() {
		defer bus.ClearBusHandlers()

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

		sc.defaultHandler = func(c *Context) {
			sc.context = c
			if sc.handlerFunc != nil {
				sc.handlerFunc(sc.context)
			}
		}

		sc.m.Get("/", sc.defaultHandler)

		fn(sc)
	})
}

type scenarioContext struct {
	m              *macaron.Macaron
	context        *Context
	resp           *httptest.ResponseRecorder
	apiKey         string
	authHeader     string
	respJson       map[string]interface{}
	handlerFunc    handlerFunc
	defaultHandler macaron.Handler

	req *http.Request
}

func (sc *scenarioContext) withValidApiKey() *scenarioContext {
	sc.apiKey = "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9"
	return sc
}

func (sc *scenarioContext) withInvalidApiKey() *scenarioContext {
	sc.apiKey = "nvalidhhhhds"
	return sc
}

func (sc *scenarioContext) withAuthoriziationHeader(authHeader string) *scenarioContext {
	sc.authHeader = authHeader
	return sc
}

func (sc *scenarioContext) fakeReq(method, url string) *scenarioContext {
	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(method, url, nil)
	So(err, ShouldBeNil)
	sc.req = req

	// add session cookie from last request
	if sc.context != nil {
		if sc.context.Session.ID() != "" {
			req.Header.Add("Cookie", "grafana_sess="+sc.context.Session.ID()+";")
		}
	}

	return sc
}

func (sc *scenarioContext) handler(fn handlerFunc) *scenarioContext {
	sc.handlerFunc = fn
	return sc
}

func (sc *scenarioContext) exec() {
	if sc.apiKey != "" {
		sc.req.Header.Add("Authorization", "Bearer "+sc.apiKey)
	}

	if sc.authHeader != "" {
		sc.req.Header.Add("Authorization", sc.authHeader)
	}

	sc.m.ServeHTTP(sc.resp, sc.req)

	if sc.resp.Header().Get("Content-Type") == "application/json; charset=UTF-8" {
		err := json.NewDecoder(sc.resp.Body).Decode(&sc.respJson)
		So(err, ShouldBeNil)
	}
}

type scenarioFunc func(c *scenarioContext)
type handlerFunc func(c *Context)
