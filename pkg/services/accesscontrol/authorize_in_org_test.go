package accesscontrol_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestAuthorizeInOrgMiddleware(t *testing.T) {
	cfg := setting.NewCfg()
	ac := acimpl.ProvideAccessControl(cfg)

	// Define test cases
	testCases := []struct {
		name            string
		orgIDGetter     accesscontrol.OrgIDGetter
		evaluator       accesscontrol.Evaluator
		accessControl   accesscontrol.AccessControl
		acService       accesscontrol.Service
		userCache       user.Service
		ctxSignedInUser *user.SignedInUser
		expectedStatus  int
	}{
		{
			name: "should authorize user with global org ID - no fetch",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return accesscontrol.GlobalOrgID, nil
			},
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			acService:       &actest.FakeService{},
			userCache:       &usertest.FakeUserService{},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			expectedStatus:  http.StatusOK,
		},
		{
			name: "should authorize user with non-global org ID - no fetch",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			acService:       &actest.FakeService{},
			userCache:       &usertest.FakeUserService{},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			expectedStatus:  http.StatusOK,
		},
		{
			name: "should return 403 when user has no permissions for the org",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			userCache:       &usertest.FakeUserService{},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}},
			acService:       &actest.FakeService{},
			expectedStatus:  http.StatusForbidden,
		},
		{
			name: "should return 403 when user org ID doesn't match and user does not exist in org 2",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 2, nil
			},
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			userCache:       &usertest.FakeUserService{ExpectedError: fmt.Errorf("user not found")},
			acService:       &actest.FakeService{},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			expectedStatus:  http.StatusForbidden,
		},
		{
			name: "should fetch user permissions when they are empty",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator:     accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: ac,
			acService: &actest.FakeService{
				ExpectedPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			userCache: &usertest.FakeUserService{
				GetSignedInUserFn: func(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
					return &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: nil}, nil
				},
			},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: nil},
			expectedStatus:  http.StatusOK,
		},
		{
			name: "should fetch user permissions when org ID doesn't match",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 2, nil
			},
			evaluator:     accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: ac,
			acService: &actest.FakeService{
				ExpectedPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			},
			userCache: &usertest.FakeUserService{
				GetSignedInUserFn: func(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
					return &user.SignedInUser{UserID: 1, OrgID: 2, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}}, nil
				},
			},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:write": {"users:*"}}}},
			expectedStatus:  http.StatusOK,
		},
		{
			name: "fails to fetch user permissions when org ID doesn't match",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 2, nil
			},
			evaluator:     accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: ac,
			acService: &actest.FakeService{
				ExpectedErr: fmt.Errorf("failed to get user permissions"),
			},
			userCache: &usertest.FakeUserService{
				GetSignedInUserFn: func(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
					return &user.SignedInUser{UserID: 1, OrgID: 2, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}}, nil
				},
			},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			expectedStatus:  http.StatusForbidden,
		},
		{
			name: "unable to get target org",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 0, fmt.Errorf("unable to get target org")
			},
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			acService:       &actest.FakeService{},
			userCache:       &usertest.FakeUserService{},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			expectedStatus:  http.StatusForbidden,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create test context
			req := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)

			service := tc.acService

			// Create middleware
			middleware := accesscontrol.AuthorizeInOrgMiddleware(
				tc.accessControl,
				service,
				tc.userCache,
			)(tc.orgIDGetter, tc.evaluator)

			// Create test server
			server := web.New()
			server.Use(contextProvider(func(c *contextmodel.ReqContext) {
				c.SignedInUser = tc.ctxSignedInUser
				c.IsSignedIn = true
			}))
			server.Use(middleware)

			server.Get("/api/endpoint", func(c *contextmodel.ReqContext) {
				c.Resp.WriteHeader(http.StatusOK)
			})

			// Perform request
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, recorder.Code, fmt.Sprintf("expected body: %s", recorder.Body.String()))
		})
	}
}
