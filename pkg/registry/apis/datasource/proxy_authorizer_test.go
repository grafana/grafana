package datasource

import (
	"context"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	krequest "k8s.io/apiserver/pkg/endpoints/request"
)

type proxyAccessClient struct {
	authlib.AccessClient
	check func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)
}

func (c proxyAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return c.check(ctx, info, req, folder)
}
func TestProxyRouteAccessChecker(t *testing.T) {
	for _, tc := range []struct{ action, verb, sub string }{
		{"datasources:query", "create", "query"},
		{"alert.rules.external:read", "get_external_rules", ""},
		{"alert.rules.external:write", "set_external_rules", ""},
	} {
		t.Run(tc.action, func(t *testing.T) {
			user := &user.SignedInUser{UserUID: "user-1", OrgID: 1}
			calls := 0
			client := proxyAccessClient{check: func(ctx context.Context, gotUser authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				calls++
				require.Same(t, user, gotUser)
				require.Equal(t, authlib.CheckRequest{Namespace: "stacks-11", Group: "prometheus.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: tc.verb, Subresource: tc.sub}, req)
				require.Empty(t, folder)
				return authlib.CheckResponse{Allowed: true}, nil
			}}
			check := NewProxyRouteAccessChecker(client, "prometheus.datasource.grafana.app")
			ctx := krequest.WithNamespace(t.Context(), "stacks-11")
			allowed, err := check(ctx, user, "ds-1", tc.action)
			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, 1, calls)
			allowed, err = check(ctx, user, "ds-1", "custom:unknown")
			require.ErrorContains(t, err, "unsupported")
			require.False(t, allowed)
			require.Equal(t, 1, calls)
			allowed, err = check(t.Context(), user, "ds-1", tc.action)
			require.Error(t, err)
			require.False(t, allowed)
			require.Equal(t, 1, calls)
		})
	}
	for _, backendErr := range []error{nil, errors.New("authz unavailable")} {
		check := NewProxyRouteAccessChecker(proxyAccessClient{check: func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{}, backendErr
		}}, "prometheus.datasource.grafana.app")
		allowed, err := check(krequest.WithNamespace(t.Context(), "stacks-11"), &user.SignedInUser{}, "ds-1", "datasources:query")
		require.False(t, allowed)
		require.Equal(t, backendErr, err)
	}
}
