package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestConvertLegacyExpression(t *testing.T) {
	for _, tc := range []struct {
		name        string
		expression  *authzextv1.LegacyExpression
		permissions map[string][]string
		allowed     bool
	}{
		{
			name:       "action only with nil scopes",
			expression: legacyPermissionExpression("users:create"),
			permissions: map[string][]string{
				"users:create": {},
			},
			allowed: true,
		},
		{
			name:       "action only with an empty scope list",
			expression: legacyPermissionExpression("users:create", []string{}...),
			permissions: map[string][]string{
				"users:create": {},
			},
			allowed: true,
		},
		{
			name:       "explicit empty scope is not action only",
			expression: legacyPermissionExpression("users:create", ""),
			permissions: map[string][]string{
				"users:create": {""},
			},
			allowed: false,
		},
		{
			name:       "alternative scopes",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:missing", "dashboards:uid:dash-1"),
			permissions: map[string][]string{
				"dashboards:read": {"dashboards:uid:dash-1"},
			},
			allowed: true,
		},
		{
			name:       "wildcard stays scoped",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
			permissions: map[string][]string{
				"dashboards:read": {"folders:*"},
			},
			allowed: false,
		},
		{
			name:       "empty all at evaluator level",
			expression: legacyAllExpression(),
			allowed:    true,
		},
		{
			name:       "empty any at evaluator level",
			expression: legacyAnyExpression(),
			allowed:    false,
		},
		{
			name: "nested all and any",
			expression: legacyAllExpression(
				legacyAnyExpression(
					legacyPermissionExpression("dashboards:write", "dashboards:uid:dash-1"),
					legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: map[string][]string{
				"dashboards:read": {"dashboards:uid:dash-1"},
				"folders:read":    {"folders:uid:folder-1"},
			},
			allowed: true,
		},
		{
			name: "all preserves separate checks for the same action",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-2"),
			),
			permissions: map[string][]string{
				"dashboards:read": {"dashboards:uid:dash-1"},
			},
			allowed: false,
		},
		{
			name: "nested empty all with unrelated permissions",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read"),
				legacyAllExpression(),
			),
			permissions: map[string][]string{
				"folders:read": {"folders:*"},
			},
			allowed: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			evaluator, _, err := convertLegacyExpression(tc.expression)
			require.NoError(t, err)
			require.Equal(t, tc.allowed, evaluator.Evaluate(tc.permissions))
		})
	}
}

func TestConvertLegacyExpressionScopeMutation(t *testing.T) {
	for _, scopes := range [][]string{nil, {}} {
		evaluator, _, err := convertLegacyExpression(legacyPermissionExpression("users:create", scopes...))
		require.NoError(t, err)
		mutated, err := evaluator.MutateScopes(t.Context(), func(context.Context, string) ([]string, error) {
			t.Fatal("action-only checks must not resolve scopes")
			return nil, nil
		})
		require.NoError(t, err)
		require.True(t, mutated.Evaluate(map[string][]string{"users:create": {}}))
	}

	evaluator, _, err := convertLegacyExpression(legacyAnyExpression(
		legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
		legacyAllExpression(
			legacyPermissionExpression("dashboards:read", ""),
			legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-2"),
		),
	))
	require.NoError(t, err)

	var scopes []string
	_, err = evaluator.MutateScopes(t.Context(), func(_ context.Context, scope string) ([]string, error) {
		scopes = append(scopes, scope)
		return []string{scope}, nil
	})
	require.NoError(t, err)
	require.Equal(t, []string{"dashboards:uid:dash-1", "", "dashboards:uid:dash-2"}, scopes)
}

func TestConvertLegacyExpressionCopiesScopes(t *testing.T) {
	expression := legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1")
	evaluator, _, err := convertLegacyExpression(expression)
	require.NoError(t, err)

	expression.GetPermission().Scopes[0] = "dashboards:uid:dash-2"

	require.True(t, evaluator.Evaluate(map[string][]string{
		"dashboards:read": {"dashboards:uid:dash-1"},
	}))

	require.False(t, evaluator.Evaluate(map[string][]string{
		"dashboards:read": {"dashboards:uid:dash-2"},
	}))
}

func TestConvertLegacyExpressionLimits(t *testing.T) {
	for _, tc := range []struct {
		name       string
		expression *authzextv1.LegacyExpression
	}{
		{
			name:       "maximum depth counts the root as one",
			expression: legacyExpressionAtDepth(maxLegacyExpressionDepth),
		},
		{
			name:       "maximum nodes including the root and repeated leaves",
			expression: legacyAllExpression(repeatedLegacyPermissions(maxLegacyExpressionNodes - 1)...),
		},
		{
			name:       "maximum scopes in one permission",
			expression: legacyPermissionExpression("dashboards:read", make([]string, maxLegacyExpressionScopes)...),
		},
		{
			name: "maximum scopes across siblings",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", make([]string, maxLegacyExpressionScopes/2)...),
				legacyPermissionExpression("dashboards:read", make([]string, maxLegacyExpressionScopes/2)...),
			),
		},
		{
			name:       "maximum distinct actions",
			expression: legacyExpressionWithActions(maxLegacyExpressionActions),
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			evaluator, _, err := convertLegacyExpression(tc.expression)
			require.NoError(t, err)
			require.NotNil(t, evaluator)
		})
	}
}

func TestConvertLegacyExpressionRejectsInvalid(t *testing.T) {
	for _, tc := range invalidLegacyExpressions() {
		t.Run(tc.name, func(t *testing.T) {
			evaluator, _, err := convertLegacyExpression(tc.expression)
			require.ErrorContains(t, err, tc.wantError)
			require.Nil(t, evaluator)
		})
	}
}

func TestService_LegacyCheckExpressionValidation(t *testing.T) {
	for _, tc := range invalidLegacyExpressions() {
		t.Run(tc.name, func(t *testing.T) {
			s := NewTestService("u-1", nil, nil)
			permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
			s.permissionStore = permissions
			req := &authzextv1.LegacyCheckRequest{
				Namespace:  "org-12",
				Subject:    "user:u-1",
				Expression: tc.expression,
			}
			response, err := s.LegacyCheck(legacyCheckContext(t), req)
			require.NoError(t, err)
			require.False(t, response.GetAllowed())
			require.Contains(t, response.GetError(), tc.wantError)
			require.Empty(t, permissions.queries)
			require.Zero(t, s.store.(*fakeStore).calls)
			require.Zero(t, s.identityStore.(*fakeIdentityStore).calls)
		})
	}
}

type invalidLegacyExpressionCase struct {
	name       string
	expression *authzextv1.LegacyExpression
	wantError  string
}

func invalidLegacyExpressions() []invalidLegacyExpressionCase {
	cycle := legacyAllExpression()
	cycle.GetAll().Expressions = []*authzextv1.LegacyExpression{cycle}
	return []invalidLegacyExpressionCase{
		{
			name:      "missing expression",
			wantError: "node is required",
		},
		{
			name:       "missing node",
			expression: &authzextv1.LegacyExpression{},
			wantError:  "node is required",
		},
		{
			name: "nil permission wrapper",
			expression: &authzextv1.LegacyExpression{
				Node: (*authzextv1.LegacyExpression_Permission)(nil),
			},
			wantError: "permission is required",
		},
		{
			name: "missing permission",
			expression: &authzextv1.LegacyExpression{
				Node: &authzextv1.LegacyExpression_Permission{},
			},
			wantError: "permission is required",
		},
		{
			name:       "missing action",
			expression: legacyPermissionExpression(""),
			wantError:  "action is required",
		},
		{
			name: "nil all wrapper",
			expression: &authzextv1.LegacyExpression{
				Node: (*authzextv1.LegacyExpression_All)(nil),
			},
			wantError: "list is required",
		},
		{
			name: "nil any wrapper",
			expression: &authzextv1.LegacyExpression{
				Node: (*authzextv1.LegacyExpression_Any)(nil),
			},
			wantError: "list is required",
		},
		{
			name: "missing all list",
			expression: &authzextv1.LegacyExpression{
				Node: &authzextv1.LegacyExpression_All{},
			},
			wantError: "list is required",
		},
		{
			name: "missing any list",
			expression: &authzextv1.LegacyExpression{
				Node: &authzextv1.LegacyExpression_Any{},
			},
			wantError: "list is required",
		},
		{
			name:       "nil child in all",
			expression: legacyAllExpression(nil),
			wantError:  "node is required",
		},
		{
			name: "invalid child after an always-true branch",
			expression: legacyAnyExpression(
				legacyAllExpression(),
				legacyAllExpression(legacyPermissionExpression("")),
			),
			wantError: "action is required",
		},
		{
			name:       "depth exceeded",
			expression: legacyExpressionAtDepth(maxLegacyExpressionDepth + 1),
			wantError:  "maximum depth",
		},
		{
			name:       "in-process expression cycle",
			expression: cycle,
			wantError:  "maximum depth",
		},
		{
			name:       "nodes exceeded in a wide expression",
			expression: legacyAllExpression(repeatedLegacyPermissions(maxLegacyExpressionNodes)...),
			wantError:  "maximum nodes",
		},
		{
			name: "nodes exceeded across sibling lists",
			expression: legacyAllExpression(
				legacyAnyExpression(repeatedLegacyPermissions(maxLegacyExpressionNodes/2)...),
				legacyAllExpression(repeatedLegacyPermissions(maxLegacyExpressionNodes/2)...),
			),
			wantError: "maximum nodes",
		},
		{
			name:       "scopes exceeded in one permission",
			expression: legacyPermissionExpression("dashboards:read", make([]string, maxLegacyExpressionScopes+1)...),
			wantError:  "maximum scopes",
		},
		{
			name: "scopes exceeded across siblings",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read", make([]string, maxLegacyExpressionScopes/2)...),
				legacyPermissionExpression("dashboards:read", make([]string, maxLegacyExpressionScopes/2+1)...),
			),
			wantError: "maximum scopes",
		},
		{
			name:       "distinct actions exceeded",
			expression: legacyExpressionWithActions(maxLegacyExpressionActions + 1),
			wantError:  "maximum distinct actions",
		},
	}
}

func legacyPermissionExpression(
	action string,
	scopes ...string,
) *authzextv1.LegacyExpression {
	return &authzextv1.LegacyExpression{
		Node: &authzextv1.LegacyExpression_Permission{
			Permission: &authzextv1.LegacyPermission{
				Action: action,
				Scopes: scopes,
			},
		},
	}
}

func legacyAllExpression(
	children ...*authzextv1.LegacyExpression,
) *authzextv1.LegacyExpression {
	return &authzextv1.LegacyExpression{
		Node: &authzextv1.LegacyExpression_All{
			All: &authzextv1.LegacyExpressionList{Expressions: children},
		},
	}
}

func legacyAnyExpression(
	children ...*authzextv1.LegacyExpression,
) *authzextv1.LegacyExpression {
	return &authzextv1.LegacyExpression{
		Node: &authzextv1.LegacyExpression_Any{
			Any: &authzextv1.LegacyExpressionList{Expressions: children},
		},
	}
}

func legacyExpressionAtDepth(depth int) *authzextv1.LegacyExpression {
	expression := legacyPermissionExpression("dashboards:read")
	for level := 1; level < depth; level++ {
		expression = legacyAllExpression(expression)
	}
	return expression
}

func repeatedLegacyPermissions(count int) []*authzextv1.LegacyExpression {
	children := make([]*authzextv1.LegacyExpression, count)
	permission := legacyPermissionExpression("dashboards:read")
	for i := range children {
		children[i] = permission
	}
	return children
}

func legacyExpressionWithActions(count int) *authzextv1.LegacyExpression {
	children := make([]*authzextv1.LegacyExpression, count)
	for i := range children {
		children[i] = legacyPermissionExpression(fmt.Sprintf("action:%d", i))
	}
	return legacyAllExpression(children...)
}
