package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/stretchr/testify/require"
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
