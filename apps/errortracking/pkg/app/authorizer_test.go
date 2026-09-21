package app

import (
	"context"
	"testing"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

type roleAccessClient struct {
	authlib.AccessClient
	request authlib.CheckRequest
}

func (c *roleAccessClient) Check(_ context.Context, _ authlib.AuthInfo, request authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	c.request = request
	return authlib.CheckResponse{Allowed: request.Verb == "list"}, nil
}

func testAuthInfo(namespace string, identityType authlib.IdentityType, identifier string, permissions, delegatedPermissions []string) authlib.AuthInfo {
	access := authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{
		Namespace:            namespace,
		Permissions:          permissions,
		DelegatedPermissions: delegatedPermissions,
	}}
	if identityType == authlib.TypeUser {
		return authn.NewIDTokenAuthInfo(access, &authn.Claims[authn.IDTokenClaims]{Rest: authn.IDTokenClaims{
			Namespace:  namespace,
			Type:       identityType,
			Identifier: identifier,
		}})
	}
	return authn.NewAccessTokenAuthInfo(access)
}

func TestGetAuthorizerNamespace(t *testing.T) {
	auth := GetAuthorizer(authlib.FixedAccessClient(true))
	ctx := func(namespace string) context.Context {
		return authlib.WithAuthInfo(context.Background(), testAuthInfo(namespace, authlib.TypeAccessPolicy, "policy", []string{"error-tracking.grafana.app/events:*"}, nil))
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
	ctx := authlib.WithAuthInfo(context.Background(), testAuthInfo("stacks-123", authlib.TypeUser, "user", nil, nil))
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
	ctx := authlib.WithAuthInfo(context.Background(), testAuthInfo("stacks-123", authlib.TypeUser, "user", nil, []string{"error-tracking.grafana.app/events:create"}))
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
