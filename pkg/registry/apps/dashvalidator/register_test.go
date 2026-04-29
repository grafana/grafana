package dashvalidator

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// mockAttributes implements authorizer.Attributes for testing.
type mockAttributes struct {
	authorizer.Attributes
	verb string
}

func (m *mockAttributes) GetVerb() string {
	return m.verb
}

func TestGetAuthorizer(t *testing.T) {
	// Use real AccessControl evaluator — this tests actual permission evaluation
	// against the user's permission map, not mocked behavior.
	ac := acimpl.ProvideAccessControl(nil)

	tests := []authorizerTestCase{
		{
			name:             "unauthenticated user cannot create",
			ctx:              context.TODO(),
			attr:             &mockAttributes{verb: "create"},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "authentication required",
			expectErr:        true,
		},
		{
			name: "admin with datasources:read  + datasources:query + dashboards:create + \"create\" → Allow",
			ctx: identity.WithRequester(
				context.TODO(),
				&identity.StaticRequester{
					OrgRole: identity.RoleAdmin,
					UserID:  1,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							datasources.ActionRead:            {"datasources:*"},
							datasources.ActionQuery:           {"datasources:*"},
							dashboards.ActionDashboardsCreate: {"dashboards:*"},
						},
					},
				},
			),
			attr:             &mockAttributes{verb: "create"},
			expectedDecision: authorizer.DecisionAllow,
			expectedReason:   "",
			expectErr:        false,
		},
		{
			name: "editor with datasources:read  + datasources:query + dashboards:create + \"create\" → Allow",
			ctx: identity.WithRequester(
				context.TODO(),
				&identity.StaticRequester{
					OrgRole: identity.RoleEditor,
					UserID:  1,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							datasources.ActionRead:            {"datasources:*"},
							datasources.ActionQuery:           {"datasources:*"},
							dashboards.ActionDashboardsCreate: {"dashboards:*"},
						},
					},
				},
			),
			attr:             &mockAttributes{verb: "create"},
			expectedDecision: authorizer.DecisionAllow,
			expectErr:        false,
		},
		{
			name: "viewer with datasources:read + dashboards:create + \"create\" → Deny",
			ctx: identity.WithRequester(
				context.TODO(),
				&identity.StaticRequester{
					OrgRole: identity.RoleViewer,
					UserID:  1,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							datasources.ActionRead:            {"datasources:*"},
							dashboards.ActionDashboardsCreate: {"dashboards:*"},
						},
					},
				},
			),
			attr:             &mockAttributes{verb: "create"},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
			expectErr:        false,
		},
		{
			name: "custom role (RoleNone) with datasources:read + datasources:query + dashboards:create + \"create\" → Allow",
			ctx: identity.WithRequester(
				context.TODO(),
				&identity.StaticRequester{
					OrgRole: identity.RoleNone,
					UserID:  1,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							datasources.ActionRead:            {"datasources:*"},
							datasources.ActionQuery:           {"datasources:*"},
							dashboards.ActionDashboardsCreate: {"dashboards:*"},
						},
					},
				},
			),
			attr:             &mockAttributes{verb: "create"},
			expectedDecision: authorizer.DecisionAllow,
			expectErr:        false,
		},
		{
			name: "custom role (RoleNone) only with dashboards:create + \"create\" → Deny",
			ctx: identity.WithRequester(
				context.TODO(),
				&identity.StaticRequester{
					OrgRole: identity.RoleNone,
					UserID:  1,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							dashboards.ActionDashboardsCreate: {"dashboards:*"},
						},
					},
				},
			),
			attr:             &mockAttributes{verb: "create"},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "insufficient permissions",
			expectErr:        false,
		},
		{
			name: "editor with all datasources:read + datasources:query + dashboards:create + \"delete\" → Deny",
			ctx: identity.WithRequester(
				context.TODO(),
				&identity.StaticRequester{
					OrgRole: identity.RoleEditor,
					UserID:  1,
					OrgID:   1,
					Permissions: map[int64]map[string][]string{
						1: {
							datasources.ActionRead:            {"datasources:*"},
							datasources.ActionQuery:           {"datasources:*"},
							dashboards.ActionDashboardsCreate: {"dashboards:*"},
						},
					},
				},
			),
			attr:             &mockAttributes{verb: "delete"},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "operation not supported",
			expectErr:        false,
		},
	}

	runAuthorizerTests(t, ac, tests)
}

// runAuthorizerTests runs table-driven authorizer tests.
func runAuthorizerTests(t *testing.T, ac *acimpl.AccessControl, tests []authorizerTestCase) {
	t.Helper()
	installer := &DashValidatorAppInstaller{ac: ac}
	authz := installer.GetAuthorizer()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision, reason, err := authz.Authorize(tt.ctx, tt.attr)

			assert.Equal(t, tt.expectedDecision, decision, "unexpected decision")
			if tt.expectedReason != "" {
				assert.Contains(t, reason, tt.expectedReason)
			}
			if tt.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

type authorizerTestCase struct {
	name             string
	ctx              context.Context
	attr             authorizer.Attributes
	expectedDecision authorizer.Decision
	expectedReason   string
	expectErr        bool
}
