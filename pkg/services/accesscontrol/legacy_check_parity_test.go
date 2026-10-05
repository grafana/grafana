package accesscontrol_test

import (
	"context"
	"strings"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestLegacyCheckParityWithAccessControlEvaluator(t *testing.T) {
	newCallingService := func(namespace string) types.AuthInfo {
		return authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
			Claims: jwt.Claims{Subject: "service-account:test"},
			Rest: authn.AccessTokenClaims{
				Namespace: namespace,
			},
		})
	}

	testCases := []struct {
		name        string
		subject     string
		action      string
		scope       string
		permissions []accesscontrol.Permission
	}{
		{
			name:    "exact action and scope match",
			subject: "user:u-1",
			action:  "dashboards:read",
			scope:   "dashboards:uid:dash-1",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"},
			},
		},
		{
			name:    "wildcard scope matches",
			subject: "user:u-1",
			action:  "dashboards:read",
			scope:   "dashboards:uid:dash-2",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
			},
		},
		{
			name:    "deny when scope differs",
			subject: "user:u-1",
			action:  "dashboards:read",
			scope:   "dashboards:uid:dash-2",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"},
			},
		},
		{
			name:    "deny when action differs",
			subject: "user:u-1",
			action:  "dashboards:write",
			scope:   "dashboards:uid:dash-1",
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"},
			},
		},
		{
			name:    "multiple scopes for action still match",
			subject: "user:u-1",
			action:  "teams:read",
			scope:   "teams:id:22",
			permissions: []accesscontrol.Permission{
				{Action: "teams:read", Scope: "teams:id:11"},
				{Action: "teams:read", Scope: "teams:id:22"},
			},
		},
		{
			name:    "service account subject path parity",
			subject: "service-account:sa-1",
			action:  "datasources:query",
			scope:   "datasources:uid:prom-main",
			permissions: []accesscontrol.Permission{
				{Action: "datasources:query", Scope: "datasources:uid:prom-main"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := rbac.NewTestService(subjectID(tc.subject), tc.permissions, []store.Folder{})

			ctx := types.WithAuthInfo(context.Background(), newCallingService("org-12"))
			got, err := s.LegacyCheck(ctx, &authzextv1.LegacyCheckRequest{
				Namespace: "org-12",
				Subject:   tc.subject,
				Action:    tc.action,
				Scope:     tc.scope,
			})
			require.NoError(t, err)
			require.Empty(t, got.GetError())

			want := accesscontrol.EvalPermission(tc.action, tc.scope).
				Evaluate(accesscontrol.GroupScopesByActionContext(ctx, tc.permissions))
			require.Equal(t, want, got.GetAllowed())
		})
	}
}

func subjectID(subject string) string {
	parts := strings.SplitN(subject, ":", 2)
	if len(parts) != 2 {
		return subject
	}
	return parts[1]
}
