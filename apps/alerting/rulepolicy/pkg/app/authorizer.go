package app

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

var readVerbs = map[string]bool{"get": true, "list": true, "watch": true}

// GetAuthorizer lets any org member read the rule policy, since it describes what their alert
// rules must carry, and lets org admins change it.
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
		if readVerbs[attr.GetVerb()] || user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "only org admins can change the rule policy", nil
	})
}
