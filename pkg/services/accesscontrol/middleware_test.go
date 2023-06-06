package accesscontrol_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

type middlewareTestCase struct {
	desc           string
	expectEndpoint bool
	evaluator      accesscontrol.Evaluator
	ac             accesscontrol.AccessControl
}

func TestMiddleware(t *testing.T) {
	tests := []middlewareTestCase{
		{
			desc: "should pass middleware for correct permissions",
			ac: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			),
			evaluator:      accesscontrol.EvalPermission("users:read", "users:*"),
			expectEndpoint: true,
		},
		{
			desc: "should not reach endpoint when missing permissions",
			ac: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:1"}},
			),
			evaluator:      accesscontrol.EvalPermission("users:read", "users:*"),
			expectEndpoint: false,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			server := web.New()
			server.UseMiddleware(web.Renderer("../../public/views", "[[", "]]"))

			server.Use(contextProvider())
			server.Use(accesscontrol.Middleware(test.ac)(test.evaluator))

			endpointCalled := false
			server.Get("/", func(c *contextmodel.ReqContext) {
				endpointCalled = true
				c.Resp.WriteHeader(http.StatusOK)
			})

			request, err := http.NewRequest(http.MethodGet, "/", nil)
			assert.NoError(t, err)
			recorder := httptest.NewRecorder()

			server.ServeHTTP(recorder, request)

			assert.Equal(t, test.expectEndpoint, endpointCalled)
		})
	}
}

func TestMiddleware_forceLogin(t *testing.T) {
	tests := []struct {
		url             string
		redirectToLogin bool
	}{
		{url: "/endpoint?forceLogin=true", redirectToLogin: true},
		{url: "/endpoint?forceLogin=false"},
		{url: "/endpoint"},
	}

	for _, tc := range tests {
		var endpointCalled bool

		server := web.New()
		server.UseMiddleware(web.Renderer("../../public/views", "[[", "]]"))

		server.Get("/endpoint", func(c *contextmodel.ReqContext) {
			endpointCalled = true
			c.Resp.WriteHeader(http.StatusOK)
		})

		ac := mock.New().WithPermissions([]accesscontrol.Permission{{Action: "endpoint:read", Scope: "endpoint:1"}})
		server.Use(contextProvider(func(c *contextmodel.ReqContext) {
			c.AllowAnonymous = true
			c.SignedInUser.IsAnonymous = true
			c.IsSignedIn = false
		}))
		server.Use(
			accesscontrol.Middleware(ac)(accesscontrol.EvalPermission("endpoint:read", "endpoint:1")),
		)

		request, err := http.NewRequest(http.MethodGet, tc.url, nil)
		assert.NoError(t, err)
		recorder := httptest.NewRecorder()

		server.ServeHTTP(recorder, request)

		expectedCode := http.StatusOK
		if tc.redirectToLogin {
			expectedCode = http.StatusFound
		}
		assert.Equal(t, expectedCode, recorder.Code)
		assert.Equal(t, !tc.redirectToLogin, endpointCalled, "/endpoint should be called?")
	}
}

func contextProvider(modifiers ...func(c *contextmodel.ReqContext)) web.Handler {
	return func(c *web.Context) {
		reqCtx := &contextmodel.ReqContext{
			Context:      c,
			Logger:       log.New(""),
			SignedInUser: &user.SignedInUser{},
			IsSignedIn:   true,
			SkipDSCache:  true,
		}
		for _, modifier := range modifiers {
			modifier(reqCtx)
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), reqCtx))
	}
}
