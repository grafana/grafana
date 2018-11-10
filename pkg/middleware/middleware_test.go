package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	ms "github.com/go-macaron/session"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

func TestMiddlewareContext(t *testing.T) {
	setting.ERR_TEMPLATE_NAME = "error-template"

	Convey("Given the grafana middleware", t, func() {
		middlewareScenario("middleware should add context to injector", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").exec()
			So(sc.context, ShouldNotBeNil)
		})

		middlewareScenario("Default middleware should allow get request", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").exec()
			So(sc.resp.Code, ShouldEqual, 200)
		})

		middlewareScenario("middleware should add Cache-Control header for GET requests to API", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/api/search").exec()
			So(sc.resp.Header().Get("Cache-Control"), ShouldEqual, "no-cache")
			So(sc.resp.Header().Get("Pragma"), ShouldEqual, "no-cache")
			So(sc.resp.Header().Get("Expires"), ShouldEqual, "-1")
		})

		middlewareScenario("middleware should not add Cache-Control header to for non-API GET requests", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").exec()
			So(sc.resp.Header().Get("Cache-Control"), ShouldBeEmpty)
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

			bus.AddHandler("test", func(loginUserQuery *m.LoginUserQuery) error {
				return nil
			})

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			setting.BasicAuthEnabled = true
			authHeader := util.GetBasicAuthHeader("myUser", "myPass")
			sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

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

		middlewareScenario("Valid api key via Basic auth", func(sc *scenarioContext) {
			keyhash := util.EncodePassword("v5nAwpMafFP6znaS4urhdWDLS5511M42", "asd")

			bus.AddHandler("test", func(query *m.GetApiKeyByNameQuery) error {
				query.Result = &m.ApiKey{OrgId: 12, Role: m.ROLE_EDITOR, Key: keyhash}
				return nil
			})

			authHeader := util.GetBasicAuthHeader("api_key", "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9")
			sc.fakeReq("GET", "/").withAuthorizationHeader(authHeader).exec()

			Convey("Should return 200", func() {
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("Should init middleware context", func() {
				So(sc.context.IsSignedIn, ShouldEqual, true)
				So(sc.context.OrgId, ShouldEqual, 12)
				So(sc.context.OrgRole, ShouldEqual, m.ROLE_EDITOR)
			})
		})

		middlewareScenario("UserId in session", func(sc *scenarioContext) {

			sc.fakeReq("GET", "/").handler(func(c *m.ReqContext) {
				c.Session.Set(session.SESS_KEY_USERID, int64(12))
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
			setting.LdapEnabled = false

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			bus.AddHandler("test", func(cmd *m.UpsertUserCommand) error {
				cmd.Result = &m.User{Id: 12}
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
			setting.LdapEnabled = false

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				if query.UserId > 0 {
					query.Result = &m.SignedInUser{OrgId: 4, UserId: 33}
					return nil
				}
				return m.ErrUserNotFound
			})

			bus.AddHandler("test", func(cmd *m.UpsertUserCommand) error {
				cmd.Result = &m.User{Id: 33}
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

		middlewareScenario("When auth_proxy is enabled and IPv4 request RemoteAddr is not trusted", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"
			setting.AuthProxyWhitelist = "192.168.1.1, 2001::23"

			sc.fakeReq("GET", "/")
			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.req.RemoteAddr = "192.168.3.1:12345"
			sc.exec()

			Convey("should return 407 status code", func() {
				So(sc.resp.Code, ShouldEqual, 407)
				So(sc.resp.Body.String(), ShouldContainSubstring, "Request for user (torkelo) from 192.168.3.1 is not from the authentication proxy")
			})
		})

		middlewareScenario("When auth_proxy is enabled and IPv6 request RemoteAddr is not trusted", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"
			setting.AuthProxyWhitelist = "192.168.1.1, 2001::23"

			sc.fakeReq("GET", "/")
			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.req.RemoteAddr = "[2001:23]:12345"
			sc.exec()

			Convey("should return 407 status code", func() {
				So(sc.resp.Code, ShouldEqual, 407)
				So(sc.resp.Body.String(), ShouldContainSubstring, "Request for user (torkelo) from 2001:23 is not from the authentication proxy")
			})
		})

		middlewareScenario("When auth_proxy is enabled and request RemoteAddr is trusted", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"
			setting.AuthProxyWhitelist = "192.168.1.1, 2001::23"

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 4, UserId: 33}
				return nil
			})

			bus.AddHandler("test", func(cmd *m.UpsertUserCommand) error {
				cmd.Result = &m.User{Id: 33}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.req.RemoteAddr = "[2001::23]:12345"
			sc.exec()

			Convey("Should init context with user info", func() {
				So(sc.context.IsSignedIn, ShouldBeTrue)
				So(sc.context.UserId, ShouldEqual, 33)
				So(sc.context.OrgId, ShouldEqual, 4)
			})
		})

		middlewareScenario("When session exists for previous user, create a new session", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"
			setting.AuthProxyWhitelist = ""

			bus.AddHandler("test", func(query *m.UpsertUserCommand) error {
				query.Result = &m.User{Id: 32}
				return nil
			})

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 4, UserId: 32}
				return nil
			})

			// create session
			sc.fakeReq("GET", "/").handler(func(c *m.ReqContext) {
				c.Session.Set(session.SESS_KEY_USERID, int64(33))
			}).exec()

			oldSessionID := sc.context.Session.ID()

			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.exec()

			newSessionID := sc.context.Session.ID()

			Convey("Should not share session with other user", func() {
				So(oldSessionID, ShouldNotEqual, newSessionID)
			})
		})

		middlewareScenario("When auth_proxy and ldap enabled call sync with ldap user", func(sc *scenarioContext) {
			setting.AuthProxyEnabled = true
			setting.AuthProxyHeaderName = "X-WEBAUTH-USER"
			setting.AuthProxyHeaderProperty = "username"
			setting.AuthProxyWhitelist = ""
			setting.LdapEnabled = true

			called := false
			syncGrafanaUserWithLdapUser = func(query *m.LoginUserQuery) error {
				called = true
				query.User = &m.User{Id: 32}
				return nil
			}

			bus.AddHandler("test", func(query *m.UpsertUserCommand) error {
				query.Result = &m.User{Id: 32}
				return nil
			})

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 4, UserId: 32}
				return nil
			})

			sc.fakeReq("GET", "/")
			sc.req.Header.Add("X-WEBAUTH-USER", "torkelo")
			sc.exec()

			Convey("Should call syncGrafanaUserWithLdapUser", func() {
				So(called, ShouldBeTrue)
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
		session.StartSessionGC = func() {}
		sc.m.Use(Sessioner(&ms.Options{}, 0))
		sc.m.Use(OrgRedirect())
		sc.m.Use(AddDefaultResponseHeaders())

		sc.defaultHandler = func(c *m.ReqContext) {
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
	context        *m.ReqContext
	resp           *httptest.ResponseRecorder
	apiKey         string
	authHeader     string
	respJson       map[string]interface{}
	handlerFunc    handlerFunc
	defaultHandler macaron.Handler
	url            string

	req *http.Request
}

func (sc *scenarioContext) withValidApiKey() *scenarioContext {
	sc.apiKey = "eyJrIjoidjVuQXdwTWFmRlA2em5hUzR1cmhkV0RMUzU1MTFNNDIiLCJuIjoiYXNkIiwiaWQiOjF9"
	return sc
}

func (sc *scenarioContext) withAuthorizationHeader(authHeader string) *scenarioContext {
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
type handlerFunc func(c *m.ReqContext)
