package logsdrilldown

import (
	"context"

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

		// check if is admin
		if u.GetIsGrafanaAdmin() {
			return authorizer.DecisionAllow, "isGrafanaAdmin", nil
		}

		// Auth handling for LogsDrilldownDefaults resource
		if attr.GetResource() == "logsdrilldowndefaults" {
			// Allow list and get for everyone
			if attr.GetVerb() == "list" || attr.GetVerb() == "get" {
				return authorizer.DecisionAllow, "", nil
			}
			// Deny all other operations for non-admins
			return authorizer.DecisionDeny, "admin access required", nil
		}

		p := u.GetPermissions()

		// Auth handling for Logs Drilldown default columns
		if attr.GetResource() == "logsdrilldowndefaultcolumns" {
			// Allow get for all users
			if attr.GetVerb() == "get" {
				return authorizer.DecisionAllow, "", nil
			}
			// require plugins:write permissions for other operations
			_, ok := p[accesscontrol.PluginRolePrefix+"write"]
			if ok {
				return authorizer.DecisionAllow, "user has plugins:write", nil
			} else {
				return authorizer.DecisionDeny, "user missing plugins:write", nil
			}
		}

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
