package secret

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

const (
	ActionSecretsManagerWrite    = "secrets-manager:write"    // CREATE + UPDATE.
	ActionSecretsManagerDescribe = "secrets-manager:describe" // GET.
	ActionSecretsManagerList     = "secrets-manager:list"     // LIST.
	ActionSecretsManagerDelete   = "secrets-manager:delete"   // DELETE.
)

const (
	ScopeAll = "secrets-manager:*"
)

var (
	ScopeSecretsManagerProvider = accesscontrol.NewScopeProvider("secrets-manager")
)

func RegisterAccessControlRoles(service accesscontrol.Service) error {
	reader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager:reader",
			DisplayName: "Secrets Manager reader",
			Description: "Read secure values and keepers metadata.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerList,
					Scope:  ScopeAll,
				},
				{
					Action: ActionSecretsManagerDescribe,
					Scope:  ScopeAll,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	writer := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager:writer",
			DisplayName: "Secrets Manager writer",
			Description: "Create, update and delete secure values and keepers.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerWrite,
					Scope:  ScopeAll,
				},
				{
					Action: ActionSecretsManagerDelete,
					Scope:  ScopeAll,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	return service.DeclareFixedRoles(reader, writer)
}

func SecretAuthorizer(accessControl accesscontrol.AccessControl) authorizer.AuthorizerFunc {
	return func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		var (
			name      = attr.GetName()
			verb      = attr.GetVerb()
			namespace = attr.GetNamespace()
		)

		// Anything but CREATE and LIST requires the resource `name` to be populated.
		if name == "" && (verb != utils.VerbCreate && verb != utils.VerbList) {
			return authorizer.DecisionDeny, "no name", nil
		}

		// Parse namespace exists and has valid format.
		if namespace == "" {
			return authorizer.DecisionDeny, "namespace required", nil
		}

		namespaceInfo, err := claims.ParseNamespace(namespace)
		if err != nil {
			return authorizer.DecisionDeny, "error parsing namespace", err
		}

		// User is required.
		user, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "user required", err
		}

		// TODO: is this correct?
		if namespaceInfo.OrgID != user.GetOrgID() {
			return authorizer.DecisionDeny, "mismatch org", nil
		}

		// TODO: Scope the permission based on the resource name for `Update`, `Read` and `Delete`.
		// Currently the scope granted for all actions are '*' (all), within the boundaries of a `namespace`.
		// This would allow fine-grained secret access with RBAC, but we need some way of granting it.
		scope := ScopeSecretsManagerProvider.GetResourceScopeName(attr.GetName())

		switch verb {
		case utils.VerbCreate:
			ok, err := accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(ActionSecretsManagerWrite))
			if ok {
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionDeny, "insufficient permissions", err

		case utils.VerbGet:
			// GET will also match for sub-resources, but since we don't support any, deny it for now.
			if attr.GetSubresource() != "" {
				return authorizer.DecisionDeny, "subresources unsupported", nil
			}

			ok, err := accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(ActionSecretsManagerDescribe, scope))
			if ok {
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionDeny, "insufficient permissions", err

		case utils.VerbList:
			ok, err := accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(ActionSecretsManagerList))
			if ok {
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionDeny, "insufficient permissions", err

		case utils.VerbUpdate:
			ok, err := accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(ActionSecretsManagerWrite, scope))
			if ok {
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionDeny, "insufficient permissions", err

		case utils.VerbDelete:
			ok, err := accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(ActionSecretsManagerDelete, scope))
			if ok {
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionDeny, "insufficient permissions", err

		default:
			// Deny everything else.
			return authorizer.DecisionDeny, "forbidden action: " + verb, nil
		}
	}
}
