package dashboard

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
)

// newVariableAuthorizer authorizes dashboard.grafana.app/variables requests.
//
// It first gates on FlagGrafanaDashboardGlobalVariables via OpenFeature (when
// storage is registered, enablement is enforced here). Service identity may
// get/list/watch/delete leftovers after a flag flip so folder cleanup still
// works; create/update/patch stay denied. Users are denied while the flag is
// off. When enabled and accessControl is wired (embedded Grafana), it maps k8s
// verbs to variables:* RBAC actions. Standalone NewAPIService leaves
// accessControl nil; enablement then defers to fallback (ServiceAuthorizer).
// User variables:* checks run in admission (mutations) and the unified-storage
// checker (list/get; variables is on rbacAllowlist).
//
// Create/update/delete/list/watch use a coarse (any-scope) check. Admission
// narrows mutations to the target folder. Named get evaluates against
// variables:uid:<name>, which the scope resolver expands to folder scopes.
func newVariableAuthorizer(accessControl ac.AccessControl, fallback authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaDashboardGlobalVariables, false, openfeature.TransactionContext(ctx)) {
				if identity.IsServiceIdentity(ctx) {
					// Folder cleanup must still list and delete leftovers after a flag
					// flip. Do not allow create/update/patch — IsServiceIdentity also
					// matches Git Sync provisioning, which must not write variables
					// while the feature is off.
					switch attr.GetVerb() {
					case "get", "list", "watch", "delete", "deletecollection":
						return authorizer.DecisionAllow, "", nil
					}
				}
				return authorizer.DecisionDeny, "global dashboard variables feature is not enabled", nil
			}

			// Standalone NewAPIService never wires classic RBAC. ServiceAuthorizer
			// checks the calling service token; user variables:* is enforced
			// downstream (admission + UniStore).
			if accessControl == nil {
				if fallback != nil {
					return fallback.Authorize(ctx, attr)
				}
				return authorizer.DecisionDeny, "access control is not configured", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			var action string
			switch attr.GetVerb() {
			case "get", "list", "watch":
				action = ActionVariablesRead
			case "create":
				action = ActionVariablesCreate
			case "update", "patch":
				action = ActionVariablesWrite
			case "delete", "deletecollection":
				action = ActionVariablesDelete
			default:
				return authorizer.DecisionDeny, "unsupported verb", nil
			}

			var eval ac.Evaluator
			verb := attr.GetVerb()
			// Named get stays scoped. Mutations stay coarse; admission applies
			// the folder-scoped variables:* check.
			if verb == "get" && attr.GetName() != "" {
				eval = ac.EvalPermission(action, ScopeVariablesProvider.GetResourceScopeUID(attr.GetName()))
			} else {
				eval = ac.EvalPermission(action)
			}

			ok, err := accessControl.Evaluate(ctx, user, eval)
			if err != nil {
				return authorizer.DecisionDeny, "access denied", err
			}
			if !ok {
				return authorizer.DecisionDeny, "access denied", nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}

// variableFolderScope returns the folders:uid scope used for variable mutation
// checks. Empty folder UID (stack-wide/root) maps to the general folder.
func variableFolderScope(folderUID string) string {
	if folderUID == "" {
		folderUID = ac.GeneralFolderUID
	}
	return folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)
}
