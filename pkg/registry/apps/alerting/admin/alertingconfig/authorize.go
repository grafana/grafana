package alertingconfig

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Authorize gates k8s API verbs on AlertingConfig with three RBAC actions:
//
//   - alert.admin-config:read         — get/list/watch on the resource and
//     its /status subresource. Granted to
//     Viewer so the UI can render
//     consistent state for all roles.
//   - alert.admin-config:write        — create/update/patch/delete on the
//     resource (spec). Granted to Admin
//     only, matching the legacy
//     /api/v1/ngalert/admin_config HTTP API.
//   - alert.admin-config.status:write — write to the /status subresource.
//     Granted only to the in-process service
//     identity (see serviceIdentityPermissions
//     in pkg/apimachinery/identity/context.go);
//     not assigned to any human role. The
//     sync worker owns status writes — an
//     Admin PATCHing /status would corrupt
//     observed state until the next sync tick.
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
