package app

import (
	"context"

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

		// Check if a user is logged in
		u, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}

		// This shouldn't be necessary since above function returns err or a user
		// however, I prefer to be explicit when returning allow and leave the last return as Deny
		if u != nil {
			return authorizer.DecisionAllow, "", nil
		}

		return authorizer.DecisionDeny, "forbidden", nil
	})
}
