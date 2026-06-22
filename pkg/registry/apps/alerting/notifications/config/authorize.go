package config

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Authorize maps k8s verbs on Config (and its /status subresource) to RBAC
// actions. Config is a per-org singleton:
//   - get/list/watch → read (Viewer)
//   - create/patch/update → update (Admin). create is gated by the update
//     permission (not rejected) because the singleton must be creatable via the
//     API — and an upsert (PUT/apply to a missing object) is authorized by the
//     apiserver as create. The singleton-name check lives in the admission
//     validator, not here.
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

	// Config is a per-org singleton, so every verb authorizes against the same
	// resource scope (configs:uid:<name>); both configs:* (fixed roles) and
	// configs:uid:* (managed permissions) satisfy it.
	scope := ngmodels.ScopeAlertingConfigProvider.GetResourceScopeUID(attr.GetName())

	var action accesscontrol.Evaluator
	if attr.GetSubresource() == "status" {
		switch attr.GetVerb() {
		case "get", "list", "watch":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigRead, scope)
		case "create", "patch", "update":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigStatusUpdate, scope)
		default:
			return authorizer.DecisionNoOpinion, "", nil
		}
	} else {
		switch attr.GetVerb() {
		case "get", "list", "watch":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigRead, scope)
		case "create", "patch", "update":
			action = accesscontrol.EvalPermission(accesscontrol.ActionAlertingConfigUpdate, scope)
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
