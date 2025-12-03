package app

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Check for service identity
		if identity.IsServiceIdentity(ctx) {
			return authorizer.DecisionAllow, "", nil
		}

		// Check for access policy identity
		info, ok := claims.AuthInfoFrom(ctx)
		if ok && claims.IsIdentityType(info.GetIdentityType(), claims.TypeAccessPolicy) {
			// For access policy identities, we need to use ResourceAuthorizer
			// This requires an AccessClient, which should be provided by the API server
			// For now, we'll use the default ResourceAuthorizer from the API server
			// This will be set up by the API server's authorization chain
			return authorizer.DecisionNoOpinion, "", nil
		}

		// For regular Grafana users, check if they are admin
		u, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}

		// check if is admin
		if u.HasRole(identity.RoleAdmin) {
			return authorizer.DecisionAllow, "", nil
		}

		return authorizer.DecisionDeny, "forbidden", nil
	})
}
