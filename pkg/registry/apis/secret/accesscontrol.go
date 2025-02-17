package secret

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	// SecureValues
	ActionSecretsManagerSecureValuesCreate = "secrets-manager.securevalues:create" // CREATE.
	ActionSecretsManagerSecureValuesWrite  = "secrets-manager.securevalues:write"  // CREATE + UPDATE.
	ActionSecretsManagerSecureValuesRead   = "secrets-manager.securevalues:read"   // GET + LIST.
	ActionSecretsManagerSecureValuesDelete = "secrets-manager.securevalues:delete" // DELETE.

	// Keepers
	ActionSecretsManagerKeepersCreate = "secrets-manager.keepers:create" // CREATE.
	ActionSecretsManagerKeepersWrite  = "secrets-manager.keepers:write"  // UPDATE.
	ActionSecretsManagerKeepersRead   = "secrets-manager.keepers:read"   // GET + LIST.
	ActionSecretsManagerKeepersDelete = "secrets-manager.keepers:delete" // DELETE.
)

var (
	ScopeProviderSecretsManagerSecureValues = accesscontrol.NewScopeProvider("secrets-manager.securevalues")
	ScopeProviderSecretsManagerKeepers      = accesscontrol.NewScopeProvider("secrets-manager.keepers")

	ScopeAllSecureValues = ScopeProviderSecretsManagerSecureValues.GetResourceAllScope()
	ScopeAllKeepers      = ScopeProviderSecretsManagerKeepers.GetResourceAllScope()
)

func RegisterAccessControlRoles(service accesscontrol.Service) error {
	// SecureValues
	secureValuesReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secrets-manager.securevalues:reader",
			DisplayName: "Secrets Manager secure values reader",
			Description: "Read and list secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerSecureValuesRead,
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
					Action: ActionSecretsManagerSecureValuesCreate,
					Scope:  ScopeAllSecureValues,
				},
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
			Description: "Read and list keepers.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretsManagerKeepersRead,
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
					Action: ActionSecretsManagerKeepersCreate,
					Scope:  ScopeAllKeepers,
				},
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
