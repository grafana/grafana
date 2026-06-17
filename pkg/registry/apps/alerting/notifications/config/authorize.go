package config

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Authorize maps k8s verbs on Config (and its /status subresource) to RBAC
// actions. Config is a system-owned per-org singleton, so the verb set is
// deliberately narrow:
//   - get/list/watch → read (Viewer)
//   - patch/update → update (Admin)
//   - create → service identity only (the sync worker bootstraps the singleton
//     and seeds .status on first sync; humans update the existing one)
//   - delete/deletecollection → always rejected (deleting the singleton would
//     nuke every admin setting it carries; reset individual fields via update)
//   - status writes → service identity only (sync worker owns it; see
//     serviceIdentityPermissions in pkg/apimachinery/identity/context.go)
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
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigRead)
		case "create", "patch", "update":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigStatusUpdate)
		default:
			return authorizer.DecisionNoOpinion, "", nil
		}
	} else {
		switch attr.GetVerb() {
		case "get", "list", "watch":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigRead)
		case "patch", "update":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigUpdate)
		case "create":
			// The singleton is bootstrapped by the in-process sync worker; humans
			// update the existing one rather than creating it.
			if identity.IsServiceIdentity(ctx) {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "Config is a singleton and cannot be created directly", nil
		case "delete", "deletecollection":
			return authorizer.DecisionDeny, "Config is a singleton and cannot be deleted", nil
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
