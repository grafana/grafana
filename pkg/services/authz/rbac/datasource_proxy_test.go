package rbac

import (
	"testing"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestDatasourceProxyRulePermissions(t *testing.T) {
	for _, tc := range []struct {
		name        string
		permissions []accesscontrol.Permission
		read, write bool
	}{
		{name: "no grants"},
		{"read scoped to target", []accesscontrol.Permission{{Action: accesscontrol.ActionAlertingRuleExternalRead, Scope: "datasources:uid:ds-1"}}, true, false},
		{"write is independent", []accesscontrol.Permission{{Action: accesscontrol.ActionAlertingRuleExternalWrite, Scope: "datasources:uid:ds-1"}}, false, true},
		{"another datasource", []accesscontrol.Permission{{Action: accesscontrol.ActionAlertingRuleExternalRead, Scope: "datasources:uid:ds-2"}}, false, false},
		{"wildcard scopes", []accesscontrol.Permission{{Action: accesscontrol.ActionAlertingRuleExternalRead, Scope: "datasources:*"}, {Action: accesscontrol.ActionAlertingRuleExternalWrite, Scope: "*"}}, true, true},
		{"datasource admin does not imply rule management", []accesscontrol.Permission{{Action: "datasources:admin", Scope: "datasources:uid:ds-1"}}, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService("user-1", tc.permissions, nil)
			ctx := types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}))
			for verb, want := range map[string]bool{"get_external_rules": tc.read, "set_external_rules": tc.write} {
				res, err := service.Check(ctx, &authzv1.CheckRequest{Namespace: "default", Subject: "user:user-1", Group: "prometheus.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: verb})
				require.NoError(t, err)
				require.Equal(t, want, res.Allowed, verb)
			}
		})
	}
}
