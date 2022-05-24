package webtest

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/web"
)

var requests = map[string]*models.ReqContext{}

type Server struct {
	t             testing.TB
	Mux           *web.Mux
	RouteRegister routing.RouteRegister
	TestServer    *httptest.Server
}

// NewServer starts and returns a new server.
func NewServer(t testing.TB, routeRegister routing.RouteRegister) *Server {
	t.Helper()

	m := web.New()
	initCtx := &models.ReqContext{}
	m.Use(func(c *web.Context) {
		initCtx.Context = c
		initCtx.Logger = log.New("api-test")
		c.Map(initCtx)

		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), initCtx))
		c.Map(c.Req)
	})

	m.Use(requestContextMiddleware())

	routeRegister.Register(m.Router)
	testServer := httptest.NewServer(m)
	t.Cleanup(testServer.Close)

	return &Server{
		t:             t,
		RouteRegister: routeRegister,
		Mux:           m,
		TestServer:    testServer,
	}
}

// NewGetRequest creates a new GET request setup for test.
func (s *Server) NewGetRequest(target string) *http.Request {
	return s.NewRequest(http.MethodGet, target, nil)
}

// NewPostRequest creates a new POST request setup for test.
func (s *Server) NewPostRequest(target string, body io.Reader) *http.Request {
	return s.NewRequest(http.MethodPost, target, body)
}

// NewRequest creates a new request setup for test.
func (s *Server) NewRequest(method string, target string, body io.Reader) *http.Request {
	s.t.Helper()

	if !strings.HasPrefix(target, "/") {
		target = "/" + target
	}

	target = s.TestServer.URL + target
	req := httptest.NewRequest(method, target, body)
	reqID := generateRequestIdentifier()
	req = requestWithRequestIdentifier(req, reqID)
	req.RequestURI = ""
	return req
}

// Send sends a HTTP request to the test server and returns an HTTP response.
func (s *Server) Send(req *http.Request) (*http.Response, error) {
	return http.DefaultClient.Do(req)
}

// SendJSON sets the Content-Type header to application/json and sends
// a HTTP request to the test server and returns an HTTP response.
// Suitable for POST/PUT/PATCH requests that sends request body as JSON.
func (s *Server) SendJSON(req *http.Request) (*http.Response, error) {
	req.Header.Add("Content-Type", "application/json")
	return s.Send(req)
}

func generateRequestIdentifier() string {
	return uuid.NewString()
}

func requestWithRequestIdentifier(req *http.Request, id string) *http.Request {
	req.Header.Set("X-GRAFANA-WEB-TEST-ID", id)
	return req
}

func requestIdentifierFromRequest(req *http.Request) string {
	return req.Header.Get("X-GRAFANA-WEB-TEST-ID")
}

func RequestWithWebContext(req *http.Request, c *models.ReqContext) *http.Request {
	reqID := requestIdentifierFromRequest(req)
	requests[reqID] = c
	return req
}

func RequestWithSignedInUser(req *http.Request, user *models.SignedInUser) *http.Request {
	return RequestWithWebContext(req, &models.ReqContext{
		SignedInUser: user,
		IsSignedIn:   true,
	})
}

func requestContextFromRequest(req *http.Request) *models.ReqContext {
	reqID := requestIdentifierFromRequest(req)
	val, exists := requests[reqID]
	if !exists {
		return nil
	}

	return val
}

func requestContextMiddleware() web.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *models.ReqContext) {
		ctx := requestContextFromRequest(req)
		if ctx == nil {
			c.Next()
			return
		}

		c.SignedInUser = ctx.SignedInUser
		c.UserToken = ctx.UserToken
		c.IsSignedIn = ctx.IsSignedIn
		c.IsRenderCall = ctx.IsRenderCall
		c.AllowAnonymous = ctx.AllowAnonymous
		c.SkipCache = ctx.SkipCache
		c.RequestNonce = ctx.RequestNonce
		c.PerfmonTimer = ctx.PerfmonTimer
		c.LookupTokenErr = ctx.LookupTokenErr
		c.Map(c)
	}
}
