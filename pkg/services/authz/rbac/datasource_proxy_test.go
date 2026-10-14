package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestDatasourceProxyQueryPermissions(t *testing.T) {
	for _, tc := range []struct {
		name        string
		permissions []accesscontrol.Permission
		query       bool
	}{
		{name: "no grants"},
		{"query scoped to target", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "datasources:uid:ds-1"}}, true},
		{"another datasource", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "datasources:uid:ds-2"}}, false},
		{"datasource wildcard", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "datasources:*"}}, true},
		{"global wildcard", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "*"}}, true},
		{"datasource admin does not imply query", []accesscontrol.Permission{{Action: "datasources:admin", Scope: "datasources:uid:ds-1"}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService("user-1", tc.permissions, nil)
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
			res, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: "prometheus.datasource.grafana.app", Resource: "datasources", Subresource: "query", Name: "ds-1", Verb: "create"})
			require.NoError(t, err)
			require.Equal(t, tc.query, res.Allowed)
		})
	}
}

func TestDatasourceProxyUnmappedAction(t *testing.T) {
	for _, action := range []string{
		"custom:action",
		datasources.ActionQuery,
		accesscontrol.ActionAlertingRuleExternalRead,
		accesscontrol.ActionAlertingRuleExternalWrite,
		accesscontrol.ActionAlertingInstancesExternalRead,
		accesscontrol.ActionAlertingInstancesExternalWrite,
		accesscontrol.ActionAlertingNotificationsExternalRead,
		accesscontrol.ActionAlertingNotificationsExternalWrite,
	} {
		for _, group := range []string{"prometheus.datasource.grafana.app", "loki.datasource.grafana.app", "alertmanager.datasource.grafana.app"} {
			t.Run(action+"/"+group, func(t *testing.T) {
				// Even a matching permission must not authorize an unsupported route action.
				service := NewTestService("user-1", []accesscontrol.Permission{{Action: action, Scope: "*"}}, nil)
				ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
				res, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: group, Resource: "datasources", Name: "ds-1", Verb: action})
				require.Equal(t, codes.NotFound, status.Code(err))
				require.ErrorContains(t, err, "unsupported verb")
				require.NotNil(t, res)
				require.False(t, res.Allowed)
			})
		}
	}
}
