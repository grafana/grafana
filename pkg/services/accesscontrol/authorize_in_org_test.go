package accesscontrol_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestAuthorizeInOrgMiddleware(t *testing.T) {
	// Define test cases
	testCases := []struct {
		name           string
		orgIDGetter    accesscontrol.OrgIDGetter
		evaluator      accesscontrol.Evaluator
		accessControl  accesscontrol.AccessControl
		userCache      *mock.UserCache
		getUserPermErr error
		expectedStatus int
	}{
		{
			name: "should authorize user with global org ID",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return accesscontrol.GlobalOrgID, nil
			},
			evaluator: accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			),
			userCache:      &mock.UserCache{},
			getUserPermErr: nil,
			expectedStatus: http.StatusOK,
		},
		{
			name: "should authorize user with non-global org ID",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator: accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			),
			userCache: &mock.UserCache{
				On("GetSignedInUserWithCacheCtx", mock.Anything, &user.GetSignedInUserQuery{UserID: 1, OrgID: 1}).Return(
					&user.SignedInUser{OrgID: 1, OrgName: "org1", OrgRole: user.ROLE_ADMIN},
					nil,
				),
			},
			getUserPermErr: nil,
			expectedStatus: http.StatusOK,
		},
		{
			name: "should deny user with non-global org ID and missing permissions",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator: accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:write", Scope: "users:*"}},
			),
			userCache:      &mock.UserCache{},
			getUserPermErr: nil,
			expectedStatus: http.StatusForbidden,
		},
		{
			name: "should deny user with non-global org ID and error getting user permissions",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator: accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			),
			userCache: &mock.UserCache{
				On("GetSignedInUserWithCacheCtx", mock.Anything, &user.GetSignedInUserQuery{UserID: 1, OrgID: 1}).Return(
					nil,
					errors.New("failed to get user"),
				),
			},
			getUserPermErr: nil,
			expectedStatus: http.StatusForbidden,
		},
		{
			name: "should deny user with non-global org ID and error getting user permissions",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 1, nil
			},
			evaluator: accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl: mock.New().WithPermissions(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			),
			userCache: &mock.UserCache{
				On("GetSignedInUserWithCacheCtx", mock.Anything, &user.GetSignedInUserQuery{UserID: 1, OrgID: 1}).Return(
					nil,
					errors.New("failed to get user"),
				),
			},
			getUserPermErr: nil,
			expectedStatus: http.StatusForbidden,
		},
		{
			name: "should deny user with error getting target org ID",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 0, errors.New("failed to get org ID")
			},
			evaluator:      accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:  mock.New(),
			userCache:      &mock.UserCache{},
			getUserPermErr: nil,
			expectedStatus: http.StatusForbidden,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create test context
			ctx := context.Background()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			c := &contextmodel.ReqContext{
				Req:          req,
				IsSignedIn:   true,
				SignedInUser: &user.SignedInUser{UserID: 1, Permissions: map[int64]accesscontrol.GroupScopes{}},
			}
			c.SetCtx(ctx)

			// Create mock service
			service := &mock.Service{}
			service.On("GetUserPermissions", mock.Anything, mock.Anything, mock.Anything).Return(
				[]accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
				tc.getUserPermErr,
			)

			// Create middleware
			middleware := accesscontrol.AuthorizeInOrgMiddleware(
				tc.accessControl,
				service,
				tc.userCache,
			)(tc.orgIDGetter, tc.evaluator)

			// Create test server
			server := web.New()
			server.UseMiddleware(web.Renderer("../../public/views", "[[", "]]"))
			server.Use(contextProvider())
			server.Use(middleware)
			server.Get("/", func(c *contextmodel.ReqContext) {
				c.Resp.WriteHeader(http.StatusOK)
			})

			// Perform request
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, req)

			// Check response
			require.Equal(t, tc.expectedStatus, recorder.Code)
		})
	}
}
