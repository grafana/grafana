package dashboard

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
)

// NewVariableAuthorizer maps k8s verbs on dashboard.grafana.app/variables to
// variables:* RBAC actions. Create uses a coarse (any-scope) check; admission
// enforces the target folder scope. Get/update/delete evaluate against
// variables:uid:<name>, which the scope resolver expands to folder scopes.
func NewVariableAuthorizer(accessControl ac.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
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
			if verb == "create" || verb == "list" || verb == "watch" || attr.GetName() == "" {
				// Coarse check: user must have the action on some scope.
				// Create folder precision is enforced in admission.
				eval = ac.EvalPermission(action)
			} else {
				eval = ac.EvalPermission(action, ScopeVariablesProvider.GetResourceScopeUID(attr.GetName()))
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
// checks. Empty folder UID (org-wide/root) maps to the general folder.
func variableFolderScope(folderUID string) string {
	if folderUID == "" {
		folderUID = ac.GeneralFolderUID
	}
	return folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)
}
