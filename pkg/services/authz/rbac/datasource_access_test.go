package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestDatasourceAccessBatch(t *testing.T) {
	checks := []*authzv1.BatchCheckItem{
		{CorrelationId: "write", Verb: "update"},
		{CorrelationId: "delete", Verb: "delete"},
		{CorrelationId: "permissions-read", Verb: "get_permissions"},
		{CorrelationId: "permissions-write", Verb: "set_permissions"},
		{CorrelationId: "caching-read", Verb: "get_caching"},
		{CorrelationId: "caching-write", Verb: "set_caching"},
	}
	for _, check := range checks {
		check.Group = "prometheus.datasource.grafana.app"
		check.Resource = "datasources"
		check.Name = "ds-1"
	}
	for _, tc := range []struct {
		name        string
		permissions []accesscontrol.Permission
		allowed     []string
	}{
		{name: "no grants"},
		{
			name: "custom role actions remain independent",
			permissions: []accesscontrol.Permission{
				{Action: "datasources:write", Scope: "datasources:uid:ds-1"},
				{Action: "datasources.permissions:read", Scope: "datasources:uid:ds-1"},
				{Action: "datasources.caching:write", Scope: "datasources:uid:ds-1"},
			},
			allowed: []string{"write", "permissions-read", "caching-write"},
		},
		{
			name: "wildcard grants",
			permissions: []accesscontrol.Permission{
				{Action: "datasources:write", Scope: "*"},
				{Action: "datasources:delete", Scope: "datasources:*"},
				{Action: "datasources.permissions:read", Scope: "datasources:uid:*"},
				{Action: "datasources.permissions:write", Scope: "datasources:*"},
				{Action: "datasources.caching:read", Scope: "datasources:*"},
				{Action: "datasources.caching:write", Scope: "datasources:uid:*"},
			},
			allowed: []string{"write", "delete", "permissions-read", "permissions-write", "caching-read", "caching-write"},
		},
		{
			name: "grants for another datasource do not apply",
			permissions: []accesscontrol.Permission{
				{Action: "datasources:write", Scope: "datasources:uid:ds-2"},
				{Action: "datasources:delete", Scope: "datasources:uid:ds-2"},
				{Action: "datasources.permissions:read", Scope: "datasources:uid:ds-2"},
				{Action: "datasources.permissions:write", Scope: "datasources:uid:ds-2"},
				{Action: "datasources.caching:read", Scope: "datasources:uid:ds-2"},
				{Action: "datasources.caching:write", Scope: "datasources:uid:ds-2"},
			},
		},
		{
			name:        "admin action set does not imply caching permissions",
			permissions: []accesscontrol.Permission{{Action: "datasources:admin", Scope: "datasources:uid:ds-1"}},
			allowed:     []string{"write", "delete", "permissions-read", "permissions-write"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService("user-1", tc.permissions, nil)
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
				Rest: authn.AccessTokenClaims{Namespace: "default"},
			}))
			response, err := service.BatchCheck(ctx, &authzv1.BatchCheckRequest{
				Namespace: "default",
				Subject:   "user:user-1",
				Checks:    checks,
			})
			require.NoError(t, err)
			require.Len(t, response.Results, 6)
			allowed := []string{}
			for id, result := range response.Results {
				require.Empty(t, result.Error, id)
				if result.Allowed {
					allowed = append(allowed, id)
				}
			}
			require.ElementsMatch(t, tc.allowed, allowed)
		})
	}
}
