package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"

	"gopkg.in/macaron.v1"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/eval"
)

type middlewareTestCase struct {
	desc           string
	expectFallback bool
	expectEndpoint bool
	evaluator      eval.Evaluator
	ac             accesscontrol.AccessControl
}

func TestMiddleware(t *testing.T) {
	tests := []middlewareTestCase{
		{
			desc:           "should use fallback if access control is disabled",
			ac:             fakeAccessControl{isDisabled: true},
			expectFallback: true,
			expectEndpoint: true,
		},
		{
			desc: "should pass middleware for correct permissions",
			ac: fakeAccessControl{
				isDisabled:  false,
				permissions: []*accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			evaluator:      eval.Permission("users:read", "users:*"),
			expectFallback: false,
			expectEndpoint: true,
		},
		{
			desc: "should not reach endpoint when missing permissions",
			ac: fakeAccessControl{
				isDisabled:  false,
				permissions: []*accesscontrol.Permission{{Action: "users:read", Scope: "users:1"}},
			},
			evaluator:      eval.Permission("users:read", "users:*"),
			expectFallback: false,
			expectEndpoint: false,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {

			fallbackCalled := false
			fallback := func(c *models.ReqContext) {
				fallbackCalled = true
			}

			server := macaron.New()
			server.Use(macaron.Renderer())

			server.Use(contextProvider())
			server.Use(Middleware(test.ac)(fallback, test.evaluator))

			endpointCalled := false
			server.Get("/", func(c *models.ReqContext) {
				endpointCalled = true
			})

			request, err := http.NewRequest(http.MethodGet, "/", nil)
			assert.NoError(t, err)
			recorder := httptest.NewRecorder()

			server.ServeHTTP(recorder, request)

			assert.Equal(t, test.expectFallback, fallbackCalled)
			assert.Equal(t, test.expectEndpoint, endpointCalled)
		})
	}

}

func contextProvider() macaron.Handler {
	return func(c *macaron.Context) {
		reqCtx := &models.ReqContext{
			Context:      c,
			Logger:       log.New(""),
			SignedInUser: &models.SignedInUser{},
			IsSignedIn:   true,
			SkipCache:    true,
		}
		c.Map(reqCtx)
	}
}

var _ accesscontrol.AccessControl = new(fakeAccessControl)

type fakeAccessControl struct {
	isDisabled  bool
	permissions []*accesscontrol.Permission
}

func (f fakeAccessControl) Evaluate(ctx context.Context, user *models.SignedInUser, evaluator eval.Evaluator) (bool, error) {
	permissions, _ := f.GetUserPermissions(ctx, user)
	return evaluator.Evaluate(accesscontrol.GroupPermissions(permissions))
}

func (f fakeAccessControl) GetUserPermissions(ctx context.Context, user *models.SignedInUser) ([]*accesscontrol.Permission, error) {
	return f.permissions, nil
}

func (f fakeAccessControl) IsDisabled() bool {
	return f.isDisabled
}
