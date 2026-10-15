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
		name          string
		cases         []accesscontrol.EvaluationTestCase
		pendingReason string
	}{
		{
			name:  "Permission",
			cases: accesscontrol.PermissionEvaluateTestCases,
		},
		{
			name:          "All",
			cases:         accesscontrol.AllEvaluateTestCases,
			pendingReason: "pending: server-side EvalAll and the AccessControl empty-permission guard",
		},
		{
			name:          "Any",
			cases:         accesscontrol.AnyEvaluateTestCases,
			pendingReason: "pending: server-side EvalAny",
		},
		{
			name:          "Combined",
			cases:         accesscontrol.CombinedEvaluateTestCases,
			pendingReason: "pending: server-side nested expressions and the AccessControl empty-permission guard",
		},
	}
	for _, group := range groups {
		t.Run(group.name, func(t *testing.T) {
			for _, tc := range group.cases {
				t.Run(tc.Description(), func(t *testing.T) {
					if group.pendingReason != "" {
						t.Skip(group.pendingReason)
					}

					permission, ok := tc.Evaluator().(accesscontrol.PermissionEvaluatorForTest)
					require.True(t, ok, "wire the complete expression request before enabling this case")

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
						Namespace: namespace,
						Subject:   "user:user-1",
						Expression: &authzextv1.LegacyExpression{
							Node: &authzextv1.LegacyExpression_Permission{
								Permission: &authzextv1.LegacyPermission{Action: permission.Action, Scopes: permission.Scopes},
							},
						},
					})
					require.NoError(t, err)
					require.NotNil(t, response)

					assert.Empty(t, response.GetError())
					assert.Equal(t, tc.Expected(), response.GetAllowed())
				})
			}
		})
	}
}
