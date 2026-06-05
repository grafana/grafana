package adminconfig

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Authorize maps k8s verbs on AdminConfig (and its /status subresource)
// to three RBAC actions: read → Viewer, spec write → Admin (matches the
// legacy /api/v1/ngalert/admin_config HTTP API), status write → service
// identity only (sync worker owns it; see serviceIdentityPermissions in
// pkg/apimachinery/identity/context.go).
func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != ResourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "valid user is required", nil
	}

	var action accesscontrol.Evaluator
	if attr.GetSubresource() == "status" {
		switch attr.GetVerb() {
		case "get", "list", "watch":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingAdminConfigRead)
		case "create", "patch", "update":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingAdminConfigStatusWrite)
		default:
			return authorizer.DecisionNoOpinion, "", nil
		}
	} else {
		switch attr.GetVerb() {
		case "get", "list", "watch":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingAdminConfigRead)
		case "create", "patch", "update", "delete", "deletecollection":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingAdminConfigWrite)
		default:
			return authorizer.DecisionNoOpinion, "", nil
		}
	}

	ok, err := ac.Evaluate(ctx, user, action)
	if ok {
		return authorizer.DecisionAllow, "", nil
	}
	if err != nil {
		return authorizer.DecisionDeny, err.Error(), nil
	}
	return authorizer.DecisionDeny, "", nil
}
