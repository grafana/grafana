package preferences

import (
	"context"
	"slices"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

type authorizeFromName struct {
	teams    utils.TeamService
	resource map[string][]utils.ResourceOwner // may include unknown
}

func (a *authorizeFromName) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	if !attr.IsResourceRequest() || user.GetIsGrafanaAdmin() {
		return authorizer.DecisionAllow, "", nil
	}

	// Check if the request includes explicit permissions
	res := authz.CheckServicePermissions(user, attr.GetAPIGroup(), attr.GetResource(), attr.GetVerb())
	if res.Allowed {
		return authorizer.DecisionAllow, "", nil
	} else if res.ServiceCall {
		log := logging.FromContext(ctx)
		log.Info("calling service lacks required permissions",
			"isServiceCall", res.ServiceCall,
			"apiGroup", attr.GetAPIGroup(),
			"resource", attr.GetResource(),
			"verb", attr.GetVerb(),
			"permissions", len(res.Permissions),
		)
		return authorizer.DecisionDeny, "calling service lacks required permissions", nil
	}

	owners, ok := a.resource[attr.GetResource()]
	if !ok {
		return authorizer.DecisionDeny, "unknown resource", nil
	}

	if attr.GetName() == "" {
		if attr.IsReadOnly() {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "mutating request without a name", nil
	}

	name, _ := utils.ParseOwnerFromName(attr.GetName())
	if !slices.Contains(owners, name.Owner) {
		return authorizer.DecisionDeny, "unsupported owner name", nil
	}

	switch name.Owner {
	case utils.NamespaceResourceOwner:
		if attr.IsReadOnly() {
			// Everyone can see the namespace
			return authorizer.DecisionAllow, "", nil
		}
		if user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "must be an org admin to edit", nil

	case utils.UserResourceOwner:
		if user.GetUID() == name.Name {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "your identify must match the selected resource", nil

	case utils.TeamResourceOwner:
		if a.teams == nil {
			return authorizer.DecisionDeny, "team checker not configured", err
		}
		ok, err := a.teams.InTeam(ctx, user, !attr.IsReadOnly())
		if err != nil {
			return authorizer.DecisionDeny, "error fetching teams", err
		}
		if ok {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "not a team member", nil

	default:
	}

	return authorizer.DecisionDeny, "invalid name", nil
}
