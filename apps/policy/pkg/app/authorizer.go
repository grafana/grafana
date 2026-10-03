package app

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

var readVerbs = map[string]bool{"get": true, "list": true, "watch": true}

// GetAuthorizer restricts writes to service identities, so that only Grafana apps write policies
// until user-authored policies are supported. Requests from the API server's own loopback client,
// which app reconcilers use, are authorized earlier as members of the privileged group.
// Org admins may read policies and bindings to see what applies in their org.
func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}
		if identity.IsServiceIdentity(ctx) {
			return authorizer.DecisionAllow, "", nil
		}
		user, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}
		if readVerbs[attr.GetVerb()] && user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "validation policies are managed by Grafana apps", nil
	})
}
