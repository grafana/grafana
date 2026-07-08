package collections

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

// starsAuthorizer authorizes access to the stars resource. Every user may
// manage their own stars; org admins may additionally manage stars for any
// user in the org.
type starsAuthorizer struct{}

func newStarsAuthorizer() starsAuthorizer {
	return starsAuthorizer{}
}

func (starsAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil || user == nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	if attr.GetResource() != "stars" {
		return authorizer.DecisionDeny, "unsupported resource", nil
	}

	if attr.GetName() == "" {
		if attr.IsReadOnly() {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "mutating request without a name", nil
	}

	owner, ok := utils.ParseOwnerFromName(attr.GetName())
	if !ok || owner.Owner != utils.UserResourceOwner {
		return authorizer.DecisionDeny, "stars are owned by a user", nil
	}

	if user.GetIdentifier() == owner.Identifier || user.GetOrgRole() == identity.RoleAdmin {
		return authorizer.DecisionAllow, "", nil
	}
	return authorizer.DecisionDeny, "you are not the owner of the resource", nil
}
