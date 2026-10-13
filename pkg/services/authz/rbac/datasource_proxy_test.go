package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	pluginac "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestDatasourceProxyPermissions(t *testing.T) {
	for _, tc := range []struct {
		name               string
		permissions        []accesscontrol.Permission
		query, read, write bool
	}{
		{name: "no grants"},
		{"query scoped to target", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "datasources:uid:ds-1"}}, true, false, false},
		{"read scoped to target", []accesscontrol.Permission{{Action: accesscontrol.ActionAlertingRuleExternalRead, Scope: "datasources:uid:ds-1"}}, false, true, false},
		{"write is independent", []accesscontrol.Permission{{Action: accesscontrol.ActionAlertingRuleExternalWrite, Scope: "datasources:uid:ds-1"}}, false, false, true},
		{"another datasource", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "datasources:uid:ds-2"}, {Action: accesscontrol.ActionAlertingRuleExternalRead, Scope: "datasources:uid:ds-2"}, {Action: accesscontrol.ActionAlertingRuleExternalWrite, Scope: "datasources:uid:ds-2"}}, false, false, false},
		{"wildcard scopes", []accesscontrol.Permission{{Action: datasources.ActionQuery, Scope: "datasources:*"}, {Action: accesscontrol.ActionAlertingRuleExternalRead, Scope: "datasources:*"}, {Action: accesscontrol.ActionAlertingRuleExternalWrite, Scope: "*"}}, true, true, true},
		{"datasource admin does not imply query or rule management", []accesscontrol.Permission{{Action: "datasources:admin", Scope: "datasources:uid:ds-1"}}, false, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService("user-1", tc.permissions, nil)
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
			for verb, want := range map[string]bool{datasources.ActionQuery: tc.query, accesscontrol.ActionAlertingRuleExternalRead: tc.read, accesscontrol.ActionAlertingRuleExternalWrite: tc.write} {
				res, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: "prometheus.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: verb})
				require.NoError(t, err)
				require.Equal(t, want, res.Allowed, verb)
			}
		})
	}
}

func TestDatasourceProxyUnmappedAction(t *testing.T) {
	service := NewTestService("user-1", []accesscontrol.Permission{{Action: "custom:action", Scope: "datasources:uid:ds-1"}}, nil)
	ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
	res, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: "prometheus.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: "custom:action"})
	require.Equal(t, codes.NotFound, status.Code(err))
	require.ErrorContains(t, err, "unsupported verb")
	require.NotNil(t, res)
	require.False(t, res.Allowed)
}

func TestDatasourceProxyAlertmanagerPermissions(t *testing.T) {
	actions := []string{
		accesscontrol.ActionAlertingInstancesExternalRead,
		accesscontrol.ActionAlertingInstancesExternalWrite,
		accesscontrol.ActionAlertingNotificationsExternalRead,
		accesscontrol.ActionAlertingNotificationsExternalWrite,
	}
	for _, granted := range actions {
		for _, scope := range []string{"datasources:uid:ds-1", "datasources:uid:ds-2", "datasources:*", "*"} {
			t.Run(granted+"/"+scope, func(t *testing.T) {
				service := NewTestService("user-1", []accesscontrol.Permission{{Action: granted, Scope: scope}}, nil)
				ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
				for _, action := range actions {
					res, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: "alertmanager.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: action})
					require.NoError(t, err)
					require.Equal(t, action == granted && scope != "datasources:uid:ds-2", res.Allowed, action)
					legacyAllowed := pluginac.GetDataSourceRouteEvaluator("ds-1", action).Evaluate(map[string][]string{granted: {scope}})
					require.Equal(t, legacyAllowed, res.Allowed, "authz must match the legacy route permission for %s", action)
				}
			})
		}
	}
}
