package app

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		user, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}

		switch attr.GetVerb() {
		// Creating and reading (including resolving a short URL via the goto
		// redirect) stays available to any authenticated user, including org
		// role None, matching the traditional /api/short-urls behaviour.
		case "create", "get":
			return authorizer.DecisionAllow, "", nil
		}

		// Every other operation (list, watch, delete, deletecollection, and
		// updating the short URL resource or its status) is restricted to
		// admins: listing exposes every short URL in the org and the mutating
		// verbs can change or remove short URLs owned by other users. The goto
		// redirect bumps lastSeenAt on the status subresource under a
		// provisioning identity, so it does not rely on this grant.
		if user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "admin role is required", nil
	})
}
