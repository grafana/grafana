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
		{name: "Permission", cases: accesscontrol.PermissionEvaluateTestCases},
		{name: "All", cases: accesscontrol.AllEvaluateTestCases, pendingReason: "pending: LegacyCheck request and server do not support EvalAll"},
		{name: "Any", cases: accesscontrol.AnyEvaluateTestCases, pendingReason: "pending: LegacyCheck request and server do not support EvalAny"},
		{name: "Combined", cases: accesscontrol.CombinedEvaluateTestCases, pendingReason: "pending: LegacyCheck request and server do not support nested EvalAll/EvalAny expressions"},
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
					switch len(permission.Scopes) {
					case 0:
						t.Skip("pending: LegacyCheck request cannot distinguish action-only checks from an explicit empty scope")
					case 1: // we only support single-scope checks for now.
					default:
						t.Skip("pending: LegacyCheck request cannot represent multiple alternative scopes")
					}

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
						Action:    permission.Action,
						Scope:     permission.Scopes[0],
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
