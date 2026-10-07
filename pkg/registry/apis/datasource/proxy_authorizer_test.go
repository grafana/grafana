package datasource

import (
	"context"
	"errors"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
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
	for _, action := range []string{
		"datasources:query",
		"alert.rules.external:read",
		"alert.rules.external:write",
		"custom:action",
	} {
		t.Run(action, func(t *testing.T) {
			user := &user.SignedInUser{UserUID: "user-1", OrgID: 1}
			calls := 0
			client := proxyAccessClient{check: func(ctx context.Context, gotUser authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				calls++
				require.Same(t, user, gotUser)
				require.Equal(t, authlib.CheckRequest{Namespace: "stacks-11", Group: "prometheus.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Verb: action}, req)
				require.Empty(t, folder)
				return authlib.CheckResponse{Allowed: true}, nil
			}}
			check := NewProxyRouteAccessChecker(client, "prometheus.datasource.grafana.app")
			ctx := krequest.WithNamespace(t.Context(), "stacks-11")
			allowed, err := check(ctx, user, "ds-1", action)
			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, 1, calls)
			allowed, err = check(t.Context(), user, "ds-1", action)
			require.Error(t, err)
			require.False(t, allowed)
			require.Equal(t, 1, calls)
		})
	}
	for _, backendErr := range []error{nil, errors.New("authz unavailable")} {
		check := NewProxyRouteAccessChecker(proxyAccessClient{check: func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
			return authlib.CheckResponse{}, backendErr
		}}, "prometheus.datasource.grafana.app")
		allowed, err := check(krequest.WithNamespace(t.Context(), "stacks-11"), &user.SignedInUser{}, "ds-1", "custom:action")
		require.False(t, allowed)
		require.Equal(t, backendErr, err)
	}
}

func TestProxyRouteDelegatedActions(t *testing.T) {
	actions := []string{"datasources:query", "alert.rules.external:read", "alert.rules.external:write"}
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
