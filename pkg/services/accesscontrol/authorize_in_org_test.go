package accesscontrol_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestAuthorizeInOrgMiddleware(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	// Define test cases
	testCases := []struct {
		name                 string
		targetOrgId          int64
		targerOrgPermissions []accesscontrol.Permission
		orgIDGetter          accesscontrol.OrgIDGetter
		evaluator            accesscontrol.Evaluator
		accessControl        accesscontrol.AccessControl
		userIdentities       []*authn.Identity
		authnErrors          []error
		ctxSignedInUser      *user.SignedInUser
		teamService          team.Service
		expectedStatus       int
	}{
		{
			name:                 "should authorize user with global org ID - fetch",
			targetOrgId:          accesscontrol.GlobalOrgID,
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
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
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
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
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:write": {"users:*"}}}},
			expectedStatus:       http.StatusOK,
		},
		{
			name:                 "fails to fetch user permissions when org ID doesn't match",
			targetOrgId:          2,
			targerOrgPermissions: []accesscontrol.Permission{},
			evaluator:            accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:        ac,
			teamService:          &teamtest.FakeService{},
			authnErrors:          []error{fmt.Errorf("failed to get user permissions")},
			ctxSignedInUser:      &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			expectedStatus:       http.StatusForbidden,
		},
		{
			name: "unable to get target org",
			orgIDGetter: func(c *contextmodel.ReqContext) (int64, error) {
				return 0, fmt.Errorf("unable to get target org")
			},
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:read": {"users:*"}}}},
			teamService:     &teamtest.FakeService{},
			expectedStatus:  http.StatusForbidden,
		},
		{
			name:            "should fetch global user permissions when user is not a member of the target org",
			targetOrgId:     2,
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:write": {"users:*"}}}},
			userIdentities: []*authn.Identity{
				{ID: "1", OrgID: -1, Permissions: map[int64]map[string][]string{}},
				{ID: "1", OrgID: accesscontrol.GlobalOrgID, Permissions: map[int64]map[string][]string{accesscontrol.GlobalOrgID: {"users:read": {"users:*"}}}},
			},
			authnErrors:    []error{nil, nil},
			expectedStatus: http.StatusOK,
		},
		{
			name:            "should fail if user is not a member of the target org and doesn't have the right permissions globally",
			targetOrgId:     2,
			evaluator:       accesscontrol.EvalPermission("users:read", "users:*"),
			accessControl:   ac,
			ctxSignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{1: {"users:write": {"users:*"}}}},
			userIdentities: []*authn.Identity{
				{ID: "1", OrgID: -1, Permissions: map[int64]map[string][]string{}},
				{ID: "1", OrgID: accesscontrol.GlobalOrgID, Permissions: map[int64]map[string][]string{accesscontrol.GlobalOrgID: {"folders:read": {"folders:*"}}}},
			},
			authnErrors:    []error{nil, nil},
			expectedStatus: http.StatusForbidden,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create test context
			req := httptest.NewRequest(http.MethodGet, "/api/endpoint", nil)

			expectedIdentity := &authn.Identity{
				ID:          strconv.FormatInt(tc.ctxSignedInUser.UserID, 10),
				Type:        claims.TypeUser,
				OrgID:       tc.targetOrgId,
				Permissions: map[int64]map[string][]string{},
			}
			expectedIdentity.Permissions[tc.targetOrgId] = accesscontrol.GroupScopesByAction(tc.targerOrgPermissions)
			var expectedErr error
			if len(tc.authnErrors) > 0 {
				expectedErr = tc.authnErrors[0]
			}

			authnService := &authntest.FakeService{
				ExpectedIdentity:   expectedIdentity,
				ExpectedIdentities: tc.userIdentities,
				ExpectedErr:        expectedErr,
				ExpectedErrs:       tc.authnErrors,
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
			middleware := accesscontrol.AuthorizeInOrgMiddleware(tc.accessControl, authnService)(orgIDGetter, tc.evaluator)

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
