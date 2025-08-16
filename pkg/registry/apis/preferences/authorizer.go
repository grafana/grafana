package preferences

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			// require a user
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			if !attr.IsResourceRequest() || user.GetIsGrafanaAdmin() || "" == attr.GetName() {
				return authorizer.DecisionAllow, "", nil
			}

			name, found := ParseOwnerFromName(attr.GetName())
			if !found {
				return authorizer.DecisionDeny, "invalid name", nil
			}

			switch name.Owner {
			case UserResourceOwner:
				if user.GetUID() == name.Name {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "you may only fetch your own preferences", nil

			case TeamResourceOwner:
				// TODO verify that the user is in the team
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionDeny, "unsupported name", nil
		})
}
