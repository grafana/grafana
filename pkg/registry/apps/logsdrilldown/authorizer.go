package logsdrilldown

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/logsdrilldown/pkg/apis/logsdrilldown/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// GetAuthorizer returns an authorizer for all kinds managed by the logsdrilldown app.
func GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// require a user
		u, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "valid user is required", err
		}

		// Handle the defaultFields route
		if attr.GetPath() == fmt.Sprintf("/apis/%s/%s/defaultFields", v1alpha1.APIGroup, v1alpha1.APIVersion) {
			// Allow GET or LIST for everyone
			if attr.GetVerb() == "get" || attr.GetVerb() == "list" {
				return authorizer.DecisionAllow, "", nil
			}
			// Only allow PUT for admins
			if attr.GetVerb() == "update" || attr.GetVerb() == "put" {
				if u.GetIsGrafanaAdmin() {
					return authorizer.DecisionAllow, "", nil
				}
				return authorizer.DecisionDeny, "admin access required", nil
			}
			// Deny other methods
			return authorizer.DecisionDeny, "method not allowed", nil
		}

		// check if is admin
		if u.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "", nil
		}

		p := u.GetPermissions()
		if len(p) == 0 {
			return authorizer.DecisionDeny, "no permissions", nil
		}

		_, ok := p[accesscontrol.ActionDatasourcesExplore]
		if !ok {
			// defer to the default authorizer if datasources:explore is not present
			return authorizer.DecisionNoOpinion, "", nil
		}

		switch attr.GetVerb() {
		case "list":
			// Allow everyone to list logsdrilldowns
			return authorizer.DecisionAllow, "", nil
		case "get":
			// Allow everyone to get individual logsdrilldowns
			return authorizer.DecisionAllow, "", nil
		case "create":
			// Create requests are validated later since we don't have access to the resource name
			return authorizer.DecisionAllow, "", nil
		case "delete", "patch", "update":
			// Only allow the user to access their own settings
			if !compareResourceNameAndUserUID(attr.GetName(), u) {
				return authorizer.DecisionDeny, "forbidden", nil
			}
			return authorizer.DecisionAllow, "", nil
		default:
			// Forbid the rest
			return authorizer.DecisionDeny, "forbidden", nil
		}
	})
}
