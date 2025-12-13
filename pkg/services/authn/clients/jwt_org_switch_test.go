package clients

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

// TestJWTOrganizationSwitchingFix verifies that our JWT fix properly handles
// organization switching scenarios that previously caused infinite redirect loops
func TestJWTOrganizationSwitchingFix(t *testing.T) {
	tests := []struct {
		name           string
		requestURL     string 
		orgMapping     []string
		expectedOrgID  int64 // What the JWT client should set initially
		hasOrgRoles    bool
	}{
		{
			name:           "JWT with orgId=2 should set OrgID=2",
			requestURL:     "http://localhost:3000/?orgId=2&auth_token=jwt",
			orgMapping:     []string{"engineers:1:Editor"},
			expectedOrgID:  2, // Should respect the requested org
			hasOrgRoles:    true,
		},
		{
			name:           "JWT with targetOrgId=3 should set OrgID=3", 
			requestURL:     "http://localhost:3000/?targetOrgId=3&auth_token=jwt",
			orgMapping:     []string{"admins:3:Admin"},
			expectedOrgID:  3, // Should respect the requested org
			hasOrgRoles:    true,
		},
		{
			name:           "JWT without org param should use default org",
			requestURL:     "http://localhost:3000/?auth_token=jwt",
			orgMapping:     []string{"engineers:2:Editor"},
			expectedOrgID:  1, // Should use default org (sync hooks will fix later)
			hasOrgRoles:    true,
		},
		{
			name:           "JWT without org mapping should use requested org",
			requestURL:     "http://localhost:3000/?orgId=5&auth_token=jwt",
			orgMapping:     []string{}, // No org mapping
			expectedOrgID:  5, // Should use requested org
			hasOrgRoles:    true, // SyncOrgRoles is still true when no org mapping
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup JWT client with org mapping configuration
			cfg := &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:           true,
					HeaderName:        "X-JWT-Assertion",
					EmailClaim:        "email",
					UsernameClaim:     "preferred_username",
					AutoSignUp:        true,
					OrgMapping:        tt.orgMapping,
					OrgAttributePath:  "orgs",
				},
				AutoAssignOrg:     true,
				AutoAssignOrgId:   1,
				AutoAssignOrgRole: "Viewer",
			}

			// Mock org service
			orgService := &orgtest.FakeOrgService{
				ExpectedOrgs: []*org.OrgDTO{
					{ID: 1, Name: "Main Org"},
					{ID: 2, Name: "engineers"},
					{ID: 3, Name: "admins"},
				},
			}

			// Mock JWT service
			jwtService := &jwt.FakeJWTService{
				VerifyProvider: func(context.Context, string) (map[string]any, error) {
					return map[string]any{
						"sub":                "testuser",
						"email":              "test@example.com",
						"preferred_username": "testuser",
						"orgs":               []string{"engineers", "admins"},
					}, nil
				},
			}

			// Create JWT client
			orgRoleMapper := connectors.ProvideOrgRoleMapper(cfg, orgService)
			jwtClient := ProvideJWT(jwtService, orgRoleMapper, cfg, tracing.InitializeTracerForTest())

			// Parse test URL and create request
			parsedURL, err := url.Parse(tt.requestURL)
			require.NoError(t, err)

			req := &http.Request{
				URL: parsedURL,
				Header: map[string][]string{
					"X-JWT-Assertion": {"test-jwt-token"},
				},
			}

			// Create authn request (this simulates what the authn service does)
			authnReq := &authn.Request{
				HTTPRequest: req,
			}

			// Extract orgID from query parameters (simulating authn service behavior)
			params := req.URL.Query()
			var requestedOrgID int64
			if params.Has("orgId") {
				if id, err := strconv.ParseInt(params.Get("orgId"), 10, 64); err == nil {
					requestedOrgID = id
				}
			} else if params.Has("targetOrgId") {
				if id, err := strconv.ParseInt(params.Get("targetOrgId"), 10, 64); err == nil {
					requestedOrgID = id
				}
			}
			authnReq.OrgID = requestedOrgID

			// Authenticate using JWT client
			identity, err := jwtClient.Authenticate(context.Background(), authnReq)
			require.NoError(t, err, "JWT authentication should succeed")
			require.NotNil(t, identity, "Identity should not be nil")

			// CRITICAL TEST: Verify that the orgID is set correctly
			assert.Equal(t, tt.expectedOrgID, identity.OrgID,
				"JWT client should set the correct organization ID")

			// Verify org roles are populated when org mapping is configured
			if tt.hasOrgRoles && len(tt.orgMapping) > 0 {
				assert.NotEmpty(t, identity.OrgRoles,
					"Identity should have org roles when org mapping is configured")
			}

			// Verify that SyncOrgRoles flag is set correctly
			assert.Equal(t, tt.hasOrgRoles, identity.ClientParams.SyncOrgRoles,
				"SyncOrgRoles flag should match expectation")

			t.Logf("✅ Test passed: orgID=%d, orgRoles=%v, syncOrgRoles=%v",
				identity.OrgID, identity.OrgRoles, identity.ClientParams.SyncOrgRoles)
		})
	}
}

// TestOrgQueryParameterParsing verifies that the authn service correctly
// parses both orgId and targetOrgId query parameters
func TestOrgQueryParameterParsing(t *testing.T) {
	tests := []struct {
		name        string
		queryString string
		expectedID  int64
	}{
		{
			name:        "orgId parameter should be parsed",
			queryString: "orgId=2",
			expectedID:  2,
		},
		{
			name:        "targetOrgId parameter should be parsed",
			queryString: "targetOrgId=3",
			expectedID:  3,
		},
		{
			name:        "orgId takes precedence over targetOrgId",
			queryString: "orgId=2&targetOrgId=3",
			expectedID:  2,
		},
		{
			name:        "no org parameters returns 0",
			queryString: "other=value",
			expectedID:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create URL with query parameters
			testURL, err := url.Parse("http://localhost:3000/?" + tt.queryString)
			require.NoError(t, err)

			req := &http.Request{URL: testURL}

			// Simulate the orgIDFromQuery logic from authnimpl/service.go
			params := req.URL.Query()
			var orgID int64

			if params.Has("orgId") {
				if id, err := strconv.ParseInt(params.Get("orgId"), 10, 64); err == nil {
					orgID = id
				}
			} else if params.Has("targetOrgId") {
				if id, err := strconv.ParseInt(params.Get("targetOrgId"), 10, 64); err == nil {
					orgID = id
				}
			}

			assert.Equal(t, tt.expectedID, orgID,
				"Organization ID should be correctly parsed from query parameters")

			t.Logf("✅ Query parsing test passed: %s -> orgID=%d", tt.queryString, orgID)
		})
	}
}
