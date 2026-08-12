package app

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// GetAuthorizer returns the authorizer for the Network kind.
//
// This is the minimal-viable policy carried over from shorturl: any
// authenticated requester in the resolved namespace can create/get, everything
// else requires org admin. Team-level per-network RBAC is out of scope for
// this prototype (see resourcepermissions.Options{APIGroup, K8sActionFormat}
// for a template if that's built later).
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
		case "create", "get":
			return authorizer.DecisionAllow, "", nil
		}

		if user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "admin role is required", nil
	})
}
