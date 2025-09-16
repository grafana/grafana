package preferences

import (
	"context"
	"slices"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			if !attr.IsResourceRequest() || user.GetIsGrafanaAdmin() || attr.GetName() == "" {
				return authorizer.DecisionAllow, "", nil
			}

			name, found := utils.ParseOwnerFromName(attr.GetName())
			if !found {
				return authorizer.DecisionDeny, "invalid name", nil
			}

			if attr.GetResource() == "stars" && name.Owner != utils.UserResourceOwner {
				return authorizer.DecisionDeny, "stars only support users", nil
			}

			switch name.Owner {
			case utils.NamespaceResourceOwner:
				return authorizer.DecisionAllow, "", nil

			case utils.UserResourceOwner:
				if user.GetUID() == name.Name {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "you may only fetch your own preferences", nil

			case utils.TeamResourceOwner:
				admin := !attr.IsReadOnly() // we need admin to for non read only commands
				teams, err := b.sql.GetTeams(ctx, user.GetOrgID(), user.GetUID(), admin)
				if err != nil {
					return authorizer.DecisionDeny, "error fetching teams", err
				}
				if slices.Contains(teams, name.Name) {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "not a team member", nil

			default:
			}

			return authorizer.DecisionDeny, "invalid name", nil
		})
}
