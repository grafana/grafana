package app

import (
	"context"
	"testing"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type roleAccessClient struct {
	authlib.AccessClient
	request authlib.CheckRequest
}

func (c *roleAccessClient) Check(_ context.Context, _ authlib.AuthInfo, request authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	c.request = request
	return authlib.CheckResponse{Allowed: request.Verb == "list"}, nil
}

func TestGetAuthorizerNamespace(t *testing.T) {
	auth := GetAuthorizer(authlib.FixedAccessClient(true))
	ctx := func(namespace string) context.Context {
		return identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:      authlib.TypeAccessPolicy,
			Namespace: namespace,
			AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
				Rest: authn.AccessTokenClaims{Permissions: []string{"error-tracking.grafana.app/events:*"}},
			},
		})
	}
	for _, tc := range []struct {
		name, identityNamespace, requestNamespace string
		want                                      authorizer.Decision
	}{
		{name: "own tenant", identityNamespace: "stacks-123", requestNamespace: "stacks-123", want: authorizer.DecisionAllow},
		{name: "other tenant", identityNamespace: "stacks-123", requestNamespace: "stacks-456", want: authorizer.DecisionDeny},
		{name: "default tenant", identityNamespace: "default", requestNamespace: "default", want: authorizer.DecisionAllow},
	} {
		t.Run(tc.name, func(t *testing.T) {
			decision, _, err := auth.Authorize(ctx(tc.identityNamespace), authorizer.AttributesRecord{
				ResourceRequest: true,
				APIGroup:        "error-tracking.grafana.app",
				Resource:        "events",
				Verb:            "create",
				Namespace:       tc.requestNamespace,
			})
			require.NoError(t, err)
			require.Equal(t, tc.want, decision)
		})
	}
}

func TestGetAuthorizerDeniesSameTenantWithoutServicePermission(t *testing.T) {
	auth := GetAuthorizer(authlib.FixedAccessClient(true))
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "stacks-123"})
	decision, _, err := auth.Authorize(ctx, authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        "error-tracking.grafana.app",
		Resource:        "events",
		Verb:            "create",
		Namespace:       "stacks-123",
	})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
}

func TestGetAuthorizerDeniesSameTenantWithoutUserPermission(t *testing.T) {
	accessClient := &roleAccessClient{}
	auth := GetAuthorizer(accessClient)
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:      authlib.TypeUser,
		Namespace: "stacks-123",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{DelegatedPermissions: []string{"error-tracking.grafana.app/events:create"}},
		},
	})
	decision, _, err := auth.Authorize(ctx, authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        "error-tracking.grafana.app",
		Resource:        "events",
		Verb:            "create",
		Namespace:       "stacks-123",
	})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, authlib.CheckRequest{
		Verb:      "create",
		Group:     "error-tracking.grafana.app",
		Resource:  "events",
		Namespace: "stacks-123",
	}, accessClient.request)
}
