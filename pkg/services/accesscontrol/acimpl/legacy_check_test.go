package acimpl_test

import (
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestLegacyCheck_AccessControlEvaluate(t *testing.T) {
	for _, tc := range accessControlEvaluateTestCases {
		t.Run(tc.desc, func(t *testing.T) {
			var permissions []accesscontrol.Permission
			for action, scopes := range tc.user.GetPermissions() {
				for _, scope := range scopes {
					permissions = append(permissions, accesscontrol.Permission{Action: action, Scope: scope})
				}
			}

			var folders = []store.Folder{}
			ac := acimpl.ProvideAccessControlTest()
			service := rbac.NewTestService(
				tc.user.GetIdentifier(),
				permissions,
				folders,
			).WithLegacyScopeResolvers(
				acimpl.ProvideScopeResolverRegistry(ac),
				types.OrgNamespaceFormatter,
			)
			if tc.scopeResolver != nil {
				ac.RegisterScopeAttributeResolver(tc.resolverPrefix, tc.scopeResolver)
			}
			namespace := types.OrgNamespaceFormatter(tc.user.OrgID)
			caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
				Claims: jwt.Claims{Subject: "service-account:test"},
				Rest:   authn.AccessTokenClaims{Namespace: namespace},
			})

			response, err := service.LegacyCheck(
				types.WithAuthInfo(t.Context(), caller),
				&authzextv1.LegacyCheckRequest{
					Namespace: namespace,
					Subject:   tc.user.GetUID(),
					Expression: &authzextv1.LegacyExpression{
						Node: &authzextv1.LegacyExpression_Permission{
							Permission: &authzextv1.LegacyPermission{Action: tc.action, Scopes: []string{tc.scope}},
						},
					},
				},
			)
			require.NoError(t, err)
			require.NotNil(t, response)
			assert.Equal(t, tc.expected, response.GetAllowed())
			if tc.expectedErr != nil {
				assert.Equal(t, tc.expectedErr.Error(), response.GetError())
			} else {
				assert.Empty(t, response.GetError())
			}
		})
	}
}
