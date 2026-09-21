package app

import (
	"testing"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func testAuthInfo(namespace string, identityType authlib.IdentityType, identifier string, permissions, delegatedPermissions []string) authlib.AuthInfo {
	access := authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{
		Namespace:            namespace,
		Permissions:          permissions,
		DelegatedPermissions: delegatedPermissions,
	}}
	if identityType == authlib.TypeAccessPolicy {
		return authn.NewAccessTokenAuthInfo(access)
	}
	return authn.NewIDTokenAuthInfo(access, &authn.Claims[authn.IDTokenClaims]{Rest: authn.IDTokenClaims{
		Namespace: namespace, Type: identityType, Identifier: identifier,
	}})
}

func TestGetAuthorizerRejectsUntrustedTenantIdentity(t *testing.T) {
	for _, test := range []struct {
		name      string
		authInfo  authlib.AuthInfo
		namespace string
	}{
		{name: "missing", namespace: "stacks-123"},
		{name: "anonymous", authInfo: testAuthInfo("stacks-123", authlib.TypeAnonymous, "anonymous", nil, nil), namespace: "stacks-123"},
		{name: "wildcard", authInfo: testAuthInfo("*", authlib.TypeUser, "user", nil, []string{"error-tracking.grafana.app/events:list"}), namespace: "stacks-123"},
		{name: "malformed", authInfo: testAuthInfo("stacks-invalid", authlib.TypeUser, "user", nil, []string{"error-tracking.grafana.app/events:list"}), namespace: "stacks-invalid"},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := t.Context()
			if test.authInfo != nil {
				ctx = authlib.WithAuthInfo(ctx, test.authInfo)
			}
			decision, _, err := GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{
				ResourceRequest: true,
				APIGroup:        "error-tracking.grafana.app",
				Resource:        "events",
				Verb:            "list",
				Namespace:       test.namespace,
			})
			require.Error(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision)
		})
	}
}

func authorize(t *testing.T, identityNamespace, requestNamespace, verb string, identityType authlib.IdentityType, permissions, delegatedPermissions []string) authorizer.Decision {
	t.Helper()
	ctx := authlib.WithAuthInfo(t.Context(), testAuthInfo(identityNamespace, identityType, "user", permissions, delegatedPermissions))
	decision, _, err := GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        "error-tracking.grafana.app",
		Resource:        "events",
		Verb:            verb,
		Namespace:       requestNamespace,
	})
	require.NoError(t, err)
	return decision
}

func TestGetAuthorizerRequiresTenantAndServicePermission(t *testing.T) {
	for _, test := range []struct {
		name, identityNamespace, requestNamespace, verb string
		identityType                                    authlib.IdentityType
		permissions, delegatedPermissions               []string
		want                                            authorizer.Decision
	}{
		{
			name: "service can create in own tenant", identityNamespace: "stacks-123", requestNamespace: "stacks-123", verb: "create",
			identityType: authlib.TypeAccessPolicy,
			permissions:  []string{"error-tracking.grafana.app/events:create"}, want: authorizer.DecisionAllow,
		},
		{
			name: "delegated user can list in own tenant", identityNamespace: "stacks-123", requestNamespace: "stacks-123", verb: "list",
			identityType:         authlib.TypeUser,
			delegatedPermissions: []string{"error-tracking.grafana.app/events:list"}, want: authorizer.DecisionAllow,
		},
		{
			name: "other tenant is denied", identityNamespace: "stacks-123", requestNamespace: "stacks-456", verb: "create",
			identityType: authlib.TypeUser,
			permissions:  []string{"error-tracking.grafana.app/events:create"}, want: authorizer.DecisionDeny,
		},
		{
			name: "missing permission is denied", identityNamespace: "stacks-123", requestNamespace: "stacks-123", verb: "create",
			identityType:         authlib.TypeUser,
			delegatedPermissions: []string{"error-tracking.grafana.app/events:list"}, want: authorizer.DecisionDeny,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			require.Equal(t, test.want, authorize(t, test.identityNamespace, test.requestNamespace, test.verb, test.identityType, test.permissions, test.delegatedPermissions))
		})
	}
}
