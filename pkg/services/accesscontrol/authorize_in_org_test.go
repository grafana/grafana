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
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
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
		name                 string
		targetOrgId          int64
		targerOrgPermissions []accesscontrol.Permission
		orgIDGetter          accesscontrol.OrgIDGetter
		evaluator            accesscontrol.Evaluator
		accessControl        accesscontrol.AccessControl
		acService            accesscontrol.Service
		userCache            user.Service
		ctxSignedInUser      *user.SignedInUser
		teamService          team.Service
		expectedStatus       int
	}{
		{
			name:                 "should authorize user with global org ID - fetch",
			targetOrgId:          accesscontrol.GlobalOrgID,
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			targerOrgPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusOK,
		},
		{
			name:                 "should authorize user with non-global org ID - no fetch",
			targetOrgId:          1,
			targerOrgPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusOK,
		},
		{
			name:                 "should return 403 when user has no permissions for the org",
			targetOrgId:          1,
			targerOrgPermissions: []accesscontrol.Permission{},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusForbidden,
		},
		{
			name:                 "should return 200 when user has permissions for a global org",
			targetOrgId:          accesscontrol.GlobalOrgID,
			targerOrgPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusOK,
		},
		{
			name:                 "should return 403 when user has no permissions for a global org",
			targetOrgId:          accesscontrol.GlobalOrgID,
			targerOrgPermissions: []accesscontrol.Permission{},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusForbidden,
		},
		{
			name:                 "should return 403 when user org ID doesn't match and user does not exist in org 2",
			targetOrgId:          2,
			targerOrgPermissions: []accesscontrol.Permission{},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{ExpectedError: fmt.Errorf("user not found")},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusForbidden,
		},
		{
			name:                 "should return 403 early when api key org ID doesn't match",
			targetOrgId:          2,
			targerOrgPermissions: []accesscontrol.Permission{},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache:            &usertest.FakeUserService{},
			ctxSignedInUser:      &user.SignedInUser{ApiKeyID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:          &teamtest.FakeService{},
			expectedStatus:       http.StatusForbidden,
		},
		{
			name:                 "should fetch user permissions when org ID doesn't match",
			targetOrgId:          2,
			targerOrgPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			teamService:          &teamtest.FakeService{},
			userCache: &usertest.FakeUserService{
				GetSignedInUserFn: func(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
					return &user.SignedInUser{UserID: 1, OrgID: 2, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}}, nil
				},
			},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:write": {"users:*"}}}},
			expectedStatus:  http.StatusOK,
		},
		{
			name:                 "fails to fetch user permissions when org ID doesn't match",
			targetOrgId:          2,
			targerOrgPermissions: []accesscontrol.Permission{},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			teamService:          &teamtest.FakeService{},
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
			userCache:       &usertest.FakeUserService{},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:     &teamtest.FakeService{},
			expectedStatus:  http.StatusForbidden,
		},
		{
			name:                 "should fetch global user permissions when user is not a member of the target org",
			targetOrgId:          2,
			targerOrgPermissions: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			userCache: &usertest.FakeUserService{
				GetSignedInUserFn: func(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
					return &user.SignedInUser{UserID: 1, OrgID: -1, Permissions: map[int64]map[string][]string{}}, nil
				},
			},
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:write": {"users:*"}}}},
			expectedStatus:  http.StatusOK,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create test context
			req := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)

			var service accesscontrol.Service
			if tc.acService != nil {
				service = tc.acService
			} else {
				service = &actest.FakeService{
					ExpectedPermissions: tc.targerOrgPermissions,
				}
			}

			expectedIdentity := &authn.Identity{
				ID:          fmt.Sprintf("user:%v", tc.ctxSignedInUser.UserID),
				OrgID:       tc.targetOrgId,
				Permissions: map[int64]map[string][]string{},
			}
			expectedIdentity.Permissions[tc.targetOrgId] = accesscontrol.GroupScopesByAction(tc.targerOrgPermissions)

			authnService := &authntest.FakeService{
				ExpectedIdentity: expectedIdentity,
			}

			var orgIDGetter accesscontrol.OrgIDGetter
			if tc.orgIDGetter != nil {
				orgIDGetter = tc.orgIDGetter
			} else {
				orgIDGetter = func(c *contextmodel.ReqContext) (int64, error) {
					return tc.targetOrgId, nil
				}
			}

			// Create middleware
			middleware := accesscontrol.AuthorizeInOrgMiddleware(
				tc.accessControl,
				service,
				tc.userCache,
				tc.teamService,
				authnService,
			)(orgIDGetter, tc.evaluator)

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
