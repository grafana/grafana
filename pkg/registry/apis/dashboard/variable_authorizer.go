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
// It first gates on FlagGrafanaDashboardGlobalVariables via OpenFeature (variable
// storage is always registered, so enablement is enforced here). When enabled,
// it maps k8s verbs to variables:* RBAC actions.
//
// Create/update/delete/list/watch use a coarse (any-scope) check; admission
// enforces the target folder scope and allowMissingFolder orphan cleanup.
// Get evaluates against variables:uid:<name>, which the scope resolver expands
// to folder scopes.
func newVariableAuthorizer(accessControl ac.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaDashboardGlobalVariables, false, openfeature.TransactionContext(ctx)) {
				return authorizer.DecisionDeny, "global dashboard variables feature is not enabled", nil
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
			// Named get stays scoped. Mutations must stay coarse: a scoped check
			// resolves variables:uid:<name> via the parent folder, and when that
			// folder is gone the resolver fails before admission's
			// allowMissingFolder orphan-cleanup path can run.
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
