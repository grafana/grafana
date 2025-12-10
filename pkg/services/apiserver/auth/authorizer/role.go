package authorizer

import (
	"context"
	"fmt"
	"slices"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/org"
)

var _ authorizer.Authorizer = &roleAuthorizer{}

var orgRoleNoneAsViewerAPIGroups = []string{
	"productactivation.ext.grafana.com",
}

type roleAuthorizer struct{}

func NewRoleAuthorizer() *roleAuthorizer {
	return &roleAuthorizer{}
}

func (auth roleAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, fmt.Sprintf("error getting signed in user: %v", err), nil
	}

	orgRole := signedInUser.GetOrgRole()
	switch orgRole {
	case org.RoleAdmin:
		return authorizer.DecisionAllow, "", nil
	case org.RoleEditor:
		switch a.GetVerb() {
		case "get", "list", "watch", "create", "update", "patch", "delete", "put", "post":
			return authorizer.DecisionAllow, "", nil
		default:
			return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole, a), nil
		}
	case org.RoleViewer:
		switch a.GetVerb() {
		case "get", "list", "watch":
			return authorizer.DecisionAllow, "", nil
		default:
			return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole, a), nil
		}
	case org.RoleNone:
		// HOTFIX: granting Viewer actions to None roles to a fixed group of APIs,
		//  while we work on a proper fix.
		if slices.Contains(orgRoleNoneAsViewerAPIGroups, a.GetAPIGroup()) {
			switch a.GetVerb() {
			case "get", "list", "watch":
				return authorizer.DecisionAllow, "", nil
			default:
				return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole, a), nil
			}
		}
		return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole, a), nil
	}
	return authorizer.DecisionDeny, "", nil
}

func errorMessageForGrafanaOrgRole(orgRole identity.RoleType, a authorizer.Attributes) string {
	return fmt.Sprintf("Grafana org role (%s) didn't allow %s access on requested resource=%s, path=%s", orgRole, a.GetVerb(), a.GetResource(), a.GetPath())
}
