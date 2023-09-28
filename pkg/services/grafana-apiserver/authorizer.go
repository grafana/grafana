package grafanaapiserver

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

var _ authorizer.Authorizer = &grafanaAuthorizer{}

type grafanaAuthorizer struct {
	ac accesscontrol.AccessControl
}

func errorMessageForGrafanaOrgRole(grafanaOrgRole string, a authorizer.Attributes) string {
	return fmt.Sprintf("Grafana org role (%s) didn't allow %s access on requested resource=%s, path=%s", grafanaOrgRole, a.GetVerb(), a.GetResource(), a.GetPath())
}

func errorMessageForK8sGroup(k8sGroups []string, a authorizer.Attributes) string {
	return fmt.Sprintf("K8s groups (%v) didn't allow %s access on requested resource=%s, path=%s", k8sGroups, a.GetVerb(), a.GetResource(), a.GetPath())
}

func (auth grafanaAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	userInfo := a.GetUser()
	extra := userInfo.GetExtra()
	groups := userInfo.GetGroups()

	// Find the exp
	if extra["id-token"] != nil {
		fmt.Printf("TODO, get identity: %s\n", extra["id-token"])
	}

	// TODO!
	// Convert userInfo into identity!
	fmt.Printf("TODO, check authz: (%s[%v]) %s\n", userInfo.GetName(), extra, a.GetPath())

	// TODO: take orgId into account in relation to namespaced resources
	// if orgId := extra["org-id"]; len(orgId) > 0 {}

	// We are being called using a Grafana token
	if orgRole := extra["org-role"]; len(orgRole) > 0 {
		// NOTE: signedInUser only has one org role which the authenticator is providing through header auth
		// That is the single role the below logic is based off of
		// TBD: is a single value enough for our purposes?
		switch org.RoleType(orgRole[0]) {
		case org.RoleAdmin:
			return authorizer.DecisionAllow, "", nil
		case org.RoleEditor:
			switch a.GetVerb() {
			case "get", "list", "watch", "create", "update", "patch", "delete", "put", "post":
				return authorizer.DecisionAllow, "", nil
			default:
				return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole[0], a), nil
			}
		case org.RoleViewer:
			switch a.GetVerb() {
			case "get", "list", "watch":
				return authorizer.DecisionAllow, "", nil
			default:
				return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole[0], a), nil
			}
		default:
			return authorizer.DecisionDeny, errorMessageForGrafanaOrgRole(orgRole[0], a), nil
		}
	}

	if groups != nil && len(groups) > 0 {
		for _, gr := range groups {
			if gr == "system:masters" {
				// We are being called using LoopbackConfig / internal privileged access
				return authorizer.DecisionAllow, "", nil
			}
		}
		return authorizer.DecisionDeny, errorMessageForK8sGroup(groups, a), nil
	}

	return authorizer.DecisionDeny, fmt.Sprintf("could not match either of the authorizer's criteria, denied %s access on requested resource=%s, path=%s", a.GetVerb(), a.GetResource(), a.GetPath()), nil
}
