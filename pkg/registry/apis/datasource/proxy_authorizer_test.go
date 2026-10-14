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
	for _, tc := range []struct {
		action      string
		subresource string
		verb        string
	}{
		{"datasources:query", "query", "create"},
		{"alert.rules.external:read", "alertrules", "get"},
		{"alert.rules.external:write", "alertrules", "update"},
		{"alert.instances.external:read", "alertinstances", "get"},
		{"alert.instances.external:write", "alertinstances", "update"},
		{"alert.notifications.external:read", "alertnotifications", "get"},
		{"alert.notifications.external:write", "alertnotifications", "update"},
		{"custom:action", "", "custom:action"},
	} {
		t.Run(tc.action, func(t *testing.T) {
			user := &user.SignedInUser{UserUID: "user-1", OrgID: 1}
			calls := 0
			client := proxyAccessClient{check: func(ctx context.Context, gotUser authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				calls++
				require.Same(t, user, gotUser)
				require.Equal(t, authlib.CheckRequest{Namespace: "stacks-11", Group: "test.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Subresource: tc.subresource, Verb: tc.verb}, req)
				require.Empty(t, folder)
				return authlib.CheckResponse{Allowed: true}, nil
			}}
			check := proxyRouteAccessChecker(client)
			ctx := krequest.WithNamespace(t.Context(), "stacks-11")
			allowed, err := check(ctx, user, "ds-1", tc.action)
			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, 1, calls)
			// Repeated checks use the authenticated request context.
			allowed, err = check(ctx, user, "ds-1", tc.action)
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
	for _, grantedVerb := range []string{"create", "get", "update"} {
		t.Run(grantedVerb, func(t *testing.T) {
			caller := authn.NewIDTokenAuthInfo(
				authn.Claims[authn.AccessTokenClaims]{
					Claims: jwt.Claims{Subject: "service"},
					Rest: authn.AccessTokenClaims{Namespace: "stacks-11", DelegatedPermissions: []string{
						"*.datasource.grafana.app/datasources:" + grantedVerb,
					}},
				},
				&authn.Claims[authn.IDTokenClaims]{
					Claims: jwt.Claims{Subject: "user:user-1"},
					Rest:   authn.IDTokenClaims{Namespace: "stacks-11"},
				},
			)
			check := proxyRouteAccessChecker(proxyAccessClient{check: func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
				// Authlib checks service delegation at the resource/verb level; user checks
				// must still distinguish the alerting subresources and datasource UID.
				result := authz.CheckServicePermissions(caller, req.Group, req.Resource, req.Verb)
				require.False(t, result.ServiceCall, "user permissions must still be checked")
				return authlib.CheckResponse{Allowed: result.Allowed}, nil
			}})
			for _, tc := range []struct {
				action string
				verb   string
			}{
				{"datasources:query", "create"},
				{"alert.rules.external:read", "get"},
				{"alert.rules.external:write", "update"},
				{"alert.instances.external:read", "get"},
				{"alert.instances.external:write", "update"},
				{"alert.notifications.external:read", "get"},
				{"alert.notifications.external:write", "update"},
			} {
				allowed, err := check(krequest.WithNamespace(t.Context(), "stacks-11"), &user.SignedInUser{}, "ds-1", tc.action)
				require.NoError(t, err)
				require.Equal(t, tc.verb == grantedVerb, allowed, tc.action)
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
