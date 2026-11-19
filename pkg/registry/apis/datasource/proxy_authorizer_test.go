package datasource

import (
	"context"
	"errors"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
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
func proxyRouteAccessChecker(client authlib.AccessClient) pluginproxy.RouteAccessChecker {
	return newAuthorizerTestBuilder(client).checkProxyRouteAccess
}

func TestProxyRouteAccessChecker(t *testing.T) {
	for _, action := range []string{
		"datasources:query",
		"alert.rules.external:read",
		"alert.rules.external:write",
		"alert.instances.external:read",
		"alert.instances.external:write",
		"alert.notifications.external:read",
		"alert.notifications.external:write",
		"custom:action",
	} {
		t.Run(action, func(t *testing.T) {
			user := &user.SignedInUser{UserUID: "user-1", OrgID: 1}
			calls := 0
			client := proxyAccessClient{check: func(ctx context.Context, gotUser authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				calls++
				require.Same(t, user, gotUser)
				expected := authlib.CheckRequest{Namespace: "stacks-11", Group: "test.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: action}
				if action == "datasources:query" {
					expected.Subresource = "query"
					expected.Verb = "create"
				}
				require.Equal(t, expected, req)
				require.Empty(t, folder)
				return authlib.CheckResponse{Allowed: true}, nil
			}}
			check := proxyRouteAccessChecker(client)
			ctx := krequest.WithNamespace(t.Context(), "stacks-11")
			allowed, err := check(ctx, user, "ds-1", action)
			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, 1, calls)
			// Repeated checks use the authenticated request context.
			allowed, err = check(ctx, user, "ds-1", action)
			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, 2, calls)
		})
	}
	for _, backendErr := range []error{nil, errors.New("authz unavailable")} {
		check := proxyRouteAccessChecker(proxyAccessClient{check: func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{}, backendErr
		}})
		allowed, err := check(krequest.WithNamespace(t.Context(), "stacks-11"), &user.SignedInUser{}, "ds-1", "custom:action")
		require.False(t, allowed)
		require.Equal(t, backendErr, err)
	}
}

func TestProxyRouteDelegatedActions(t *testing.T) {
	actions := []string{"datasources:query", "alert.rules.external:read", "alert.rules.external:write", "alert.instances.external:read", "alert.instances.external:write", "alert.notifications.external:read", "alert.notifications.external:write"}
	for _, granted := range actions {
		t.Run(granted, func(t *testing.T) {
			caller := authn.NewIDTokenAuthInfo(
				authn.Claims[authn.AccessTokenClaims]{
					Claims: jwt.Claims{Subject: "service"},
					Rest: authn.AccessTokenClaims{Namespace: "stacks-11", DelegatedPermissions: []string{
						"*.datasource.grafana.app/datasources:" + granted,
					}},
				},
				&authn.Claims[authn.IDTokenClaims]{
					Claims: jwt.Claims{Subject: "user:user-1"},
					Rest:   authn.IDTokenClaims{Namespace: "stacks-11"},
				},
			)
			for _, action := range actions {
				result := authz.CheckServicePermissions(caller, "prometheus.datasource.grafana.app", "datasources", action)
				require.False(t, result.ServiceCall, "user permissions must still be checked")
				require.Equal(t, action == granted, result.Allowed, action)
			}
		})
	}
}

func TestProxyRouteAccessCheckerTenantScope(t *testing.T) {
	var namespaces []string
	client := proxyAccessClient{check: func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
		namespaces = append(namespaces, req.Namespace)
		return authlib.CheckResponse{Allowed: true}, nil
	}}
	check := proxyRouteAccessChecker(client)
	for _, namespace := range []string{"default", "org-2", "stacks-11", "stacks-22", "stacks-11"} {
		allowed, err := check(krequest.WithNamespace(t.Context(), namespace), &user.SignedInUser{}, "same-uid", "datasources:query")
		require.NoError(t, err)
		require.True(t, allowed)
	}
	require.Equal(t, []string{"default", "org-2", "stacks-11", "stacks-22", "stacks-11"}, namespaces)

	allowed, err := check(t.Context(), &user.SignedInUser{}, "same-uid", "datasources:query")
	require.Error(t, err)
	require.False(t, allowed)
	require.Len(t, namespaces, 5, "a missing namespace must not reach authz")
}
