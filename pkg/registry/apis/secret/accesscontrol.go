package secret

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

const (
	// SecureValues
	ActionSecretsManagerSecureValuesWrite    = "secrets-manager.securevalues:write"    // CREATE + UPDATE.
	ActionSecretsManagerSecureValuesDescribe = "secrets-manager.securevalues:describe" // GET.
	ActionSecretsManagerSecureValuesList     = "secrets-manager.securevalues:list"     // LIST.
	ActionSecretsManagerSecureValuesDelete   = "secrets-manager.securevalues:delete"   // DELETE.

	// Keepers
	ActionSecretsManagerKeepersWrite    = "secrets-manager.keepers:write"    // CREATE + UPDATE.
	ActionSecretsManagerKeepersDescribe = "secrets-manager.keepers:describe" // GET.
	ActionSecretsManagerKeepersList     = "secrets-manager.keepers:list"     // LIST.
	ActionSecretsManagerKeepersDelete   = "secrets-manager.keepers:delete"   // DELETE.
)

const (
	ScopeAllSecureValues = "secrets-manager.securevalues:*"
	ScopeAllKeepers      = "secrets-manager.keepers:*"
)

var (
	ScopeProviderSecretsManagerSecureValues = accesscontrol.NewScopeProvider("secrets-manager.securevalues")
	ScopeProviderSecretsManagerKeepers      = accesscontrol.NewScopeProvider("secrets-manager.keepers")
)

func RegisterAccessControlRoles(service accesscontrol.Service) error {
	// SecureValues
	secureValuesReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager.securevalues:reader",
			DisplayName: "Secrets Manager secure values reader",
			Description: "Read secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerSecureValuesList,
					Scope:  ScopeAllSecureValues,
				},
				{
					Action: ActionSecretsManagerSecureValuesDescribe,
					Scope:  ScopeAllSecureValues,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	secureValuesWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager.securevalues:writer",
			DisplayName: "Secrets Manager secure values writer",
			Description: "Create, update and delete secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerSecureValuesWrite,
					Scope:  ScopeAllSecureValues,
				},
				{
					Action: ActionSecretsManagerSecureValuesDelete,
					Scope:  ScopeAllSecureValues,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	// Keepers
	keepersReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager.keepers:reader",
			DisplayName: "Secrets Manager keepers reader",
			Description: "Read keepers.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerKeepersList,
					Scope:  ScopeAllKeepers,
				},
				{
					Action: ActionSecretsManagerKeepersDescribe,
					Scope:  ScopeAllKeepers,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	keepersWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager.keepers:writer",
			DisplayName: "Secrets Manager keepers writer",
			Description: "Create, update and delete keepers.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerKeepersWrite,
					Scope:  ScopeAllKeepers,
				},
				{
					Action: ActionSecretsManagerKeepersDelete,
					Scope:  ScopeAllKeepers,
				},
			},
		},
		Grants: []string{string(accesscontrol.RoleGrafanaAdmin)},
	}

	return service.DeclareFixedRoles(
		secureValuesReader, secureValuesWriter,
		keepersReader, keepersWriter,
	)
}

func SecretAuthorizer(accessControl accesscontrol.AccessControl) authorizer.AuthorizerFunc {
	var (
		resourceSecureValues = secretv0alpha1.SecureValuesResourceInfo.GetName()
		resourceKeepers      = secretv0alpha1.KeeperResourceInfo.GetName()
	)

	return func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		var (
			name      = attr.GetName()
			verb      = attr.GetVerb()
			resource  = attr.GetResource()
			namespace = attr.GetNamespace()
		)

		// Anything but CREATE and LIST requires the resource `name` to be populated.
		if name == "" && (verb != utils.VerbCreate && verb != utils.VerbList) {
			return authorizer.DecisionDeny, "name required", nil
		}

		// GET will also match for sub-resources, but since we don't support any, deny it for now.
		if verb == utils.VerbGet && attr.GetSubresource() != "" {
			return authorizer.DecisionDeny, "subresources unsupported", nil
		}

		// Parse namespace exists and has valid format.
		if namespace == "" {
			return authorizer.DecisionDeny, "namespace required", nil
		}

		namespaceInfo, err := claims.ParseNamespace(namespace)
		if err != nil {
			return authorizer.DecisionDeny, "invalid namespace format", err
		}

		// User is required.
		user, err := identity.GetRequester(ctx)
		if err != nil {
			return authorizer.DecisionDeny, "user required", err
		}

		// TODO: is this correct?
		if namespaceInfo.OrgID != user.GetOrgID() {
			return authorizer.DecisionDeny, "mismatched org", nil
		}

		// Based on the `kind` being requested, we use different evaluators with scopes and actions.
		var evaluatorForVerb map[string]accesscontrol.Evaluator

		switch resource {
		case resourceSecureValues:
			// TODO: Scope the permission based on the resource name for `Update`, `Read` and `Delete`.
			// Currently the scope granted for all actions are '*' (all), within the boundaries of a `namespace`.
			// This would allow fine-grained secret access with RBAC, but we need some way of granting it.
			scope := ScopeProviderSecretsManagerSecureValues.GetResourceScopeName(name)

			evaluatorForVerb = map[string]accesscontrol.Evaluator{
				utils.VerbCreate: accesscontrol.EvalPermission(ActionSecretsManagerSecureValuesWrite),
				utils.VerbGet:    accesscontrol.EvalPermission(ActionSecretsManagerSecureValuesDescribe, scope),
				utils.VerbList:   accesscontrol.EvalPermission(ActionSecretsManagerSecureValuesList),
				utils.VerbUpdate: accesscontrol.EvalPermission(ActionSecretsManagerSecureValuesWrite, scope),
				utils.VerbDelete: accesscontrol.EvalPermission(ActionSecretsManagerSecureValuesDelete, scope),
			}

		case resourceKeepers:
			// TODO: Scope the permission based on the resource name for `Update`, `Read` and `Delete`.
			// Currently the scope granted for all actions are '*' (all), within the boundaries of a `namespace`.
			// This would allow fine-grained secret access with RBAC, but we need some way of granting it.
			scope := ScopeProviderSecretsManagerKeepers.GetResourceScopeName(name)

			evaluatorForVerb = map[string]accesscontrol.Evaluator{
				utils.VerbCreate: accesscontrol.EvalPermission(ActionSecretsManagerKeepersWrite),
				utils.VerbGet:    accesscontrol.EvalPermission(ActionSecretsManagerKeepersDescribe, scope),
				utils.VerbList:   accesscontrol.EvalPermission(ActionSecretsManagerKeepersList),
				utils.VerbUpdate: accesscontrol.EvalPermission(ActionSecretsManagerKeepersWrite, scope),
				utils.VerbDelete: accesscontrol.EvalPermission(ActionSecretsManagerKeepersDelete, scope),
			}

		default:
			return authorizer.DecisionDeny, "unknown resource: " + resource, nil
		}

		evaluator, ok := evaluatorForVerb[verb]
		if !ok {
			return authorizer.DecisionDeny, "forbidden action: " + verb, nil
		}

		allowed, err := accessControl.Evaluate(ctx, user, evaluator)
		if allowed {
			return authorizer.DecisionAllow, "", nil
		}

		return authorizer.DecisionDeny, "insufficient permissions", err
	}
}
