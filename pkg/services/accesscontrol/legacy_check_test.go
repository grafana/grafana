package accesscontrol_test

import (
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestLegacyCheck_Evaluators(t *testing.T) {
	groups := []struct {
		name  string
		cases []accesscontrol.EvaluationTestCase
	}{
		{
			name:  "Permission",
			cases: accesscontrol.PermissionEvaluateTestCases,
		},
		{
			name:  "All",
			cases: accesscontrol.AllEvaluateTestCases,
		},
		{
			name:  "Any",
			cases: accesscontrol.AnyEvaluateTestCases,
		},
		{
			name:  "Combined",
			cases: accesscontrol.CombinedEvaluateTestCases,
		},
	}
	for _, group := range groups {
		t.Run(group.name, func(t *testing.T) {
			for _, tc := range group.cases {
				t.Run(tc.Description(), func(t *testing.T) {
					var permissions []accesscontrol.Permission
					for action, scopes := range tc.Permissions() {
						if len(scopes) == 0 {
							permissions = append(permissions, accesscontrol.Permission{Action: action})
						}

						for _, scope := range scopes {
							permissions = append(permissions, accesscontrol.Permission{Action: action, Scope: scope})
						}
					}

					var folders = []store.Folder{}
					service := rbac.NewTestService("user-1", permissions, folders)

					namespace := types.OrgNamespaceFormatter(1)
					caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
						Claims: jwt.Claims{Subject: "service-account:test"},
						Rest:   authn.AccessTokenClaims{Namespace: namespace},
					})

					response, err := service.LegacyCheck(types.WithAuthInfo(t.Context(), caller), &authzextv1.LegacyCheckRequest{
						Namespace:  namespace,
						Subject:    "user:user-1",
						Expression: legacyExpressionForEvaluator(t, tc.Evaluator()),
					})
					require.NoError(t, err)
					require.NotNil(t, response)

					assert.Empty(t, response.GetError())
					// Full AccessControl denies empty permission maps before
					// evaluation, including expressions containing an empty ALL.
					expected := len(tc.Permissions()) > 0 && tc.Expected()
					assert.Equal(t, expected, response.GetAllowed())
				})
			}
		})
	}
}

func legacyExpressionForEvaluator(
	t *testing.T,
	evaluator accesscontrol.Evaluator,
) *authzextv1.LegacyExpression {
	t.Helper()
	switch evaluator := evaluator.(type) {
	case accesscontrol.PermissionEvaluatorForTest:
		return &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_Permission{
				Permission: &authzextv1.LegacyPermission{Action: evaluator.Action, Scopes: evaluator.Scopes},
			},
		}
	case accesscontrol.AllEvaluatorForTest:
		children := make([]*authzextv1.LegacyExpression, 0, len(evaluator.ChildrenForTest()))
		for _, child := range evaluator.ChildrenForTest() {
			children = append(children, legacyExpressionForEvaluator(t, child))
		}
		return &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_All{All: &authzextv1.LegacyExpressionList{Expressions: children}},
		}
	case accesscontrol.AnyEvaluatorForTest:
		children := make([]*authzextv1.LegacyExpression, 0, len(evaluator.ChildrenForTest()))
		for _, child := range evaluator.ChildrenForTest() {
			children = append(children, legacyExpressionForEvaluator(t, child))
		}
		return &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_Any{Any: &authzextv1.LegacyExpressionList{Expressions: children}},
		}
	default:
		t.Fatalf("unsupported evaluator type %T", evaluator)
		return nil
	}
}
