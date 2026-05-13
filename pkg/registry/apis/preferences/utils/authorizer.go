package utils

import (
	"context"
	"slices"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type AuthorizeFromName struct {
	AccessClient authlib.AccessClient
	OKNames      []string
	Resource     map[string][]ResourceOwner // may include unknown
}

func (a *AuthorizeFromName) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil || user == nil {
		return authorizer.DecisionDeny, "valid user is required", err
	}

	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	owners, ok := a.Resource[attr.GetResource()]
	if !ok {
		return authorizer.DecisionDeny, "missing resource name", nil
	}

	// Check if the request includes explicit permissions
	res := authz.CheckServicePermissions(user, attr.GetAPIGroup(), attr.GetResource(), attr.GetVerb())
	if !res.Allowed {
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

	if attr.GetName() == "" {
		if attr.IsReadOnly() {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "mutating request without a name", nil
	}

	// the pseudo sub-resource
	if a.OKNames != nil && slices.Contains(a.OKNames, attr.GetName()) {
		return authorizer.DecisionAllow, "", nil
	}

	info, _ := ParseOwnerFromName(attr.GetName())
	if !slices.Contains(owners, info.Owner) {
		return authorizer.DecisionDeny, "unsupported owner type", nil
	}

	switch info.Owner {
	case NamespaceResourceOwner:
		if attr.IsReadOnly() {
			// Everyone can see the namespace
			return authorizer.DecisionAllow, "", nil
		}
		if user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "must be an org admin to edit", nil

	case UserResourceOwner:
		if user.GetIdentifier() == info.Identifier {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "your are not the owner of the resource", nil

	case TeamResourceOwner:
		if !attr.IsReadOnly() {
			rsp, err := a.AccessClient.Check(ctx, user, authlib.CheckRequest{
				Verb:      utils.VerbUpdate,
				Group:     "iam.grafana.app",
				Resource:  "teams",
				Namespace: user.GetNamespace(),
				Name:      info.Identifier,
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "error fetching team permissions", err
			}
			if rsp.Allowed {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "no edit permissions for the team", nil
		}

		if slices.Contains(user.GetGroups(), info.Identifier) {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "you are not a member of the referenced team", err

	case UnknownResourceOwner:
		return authorizer.DecisionAllow, "", nil
	}

	// the owner was not explicitly allowed
	return authorizer.DecisionDeny, "", nil
}
