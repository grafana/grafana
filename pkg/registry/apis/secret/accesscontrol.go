package secret

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	// SecureValues
	ActionSecretSecureValuesCreate = "secret.securevalues:create" // CREATE.
	ActionSecretSecureValuesWrite  = "secret.securevalues:write"  // UPDATE.
	ActionSecretSecureValuesRead   = "secret.securevalues:read"   // GET + LIST.
	ActionSecretSecureValuesDelete = "secret.securevalues:delete" // DELETE.

	// Keepers
	ActionSecretKeepersCreate = "secret.keepers:create" // CREATE.
	ActionSecretKeepersWrite  = "secret.keepers:write"  // UPDATE.
	ActionSecretKeepersRead   = "secret.keepers:read"   // GET + LIST.
	ActionSecretKeepersDelete = "secret.keepers:delete" // DELETE.
)

var (
	ScopeProviderSecretSecureValues = accesscontrol.NewScopeProvider("secret.securevalues")
	ScopeProviderSecretKeepers      = accesscontrol.NewScopeProvider("secret.keepers")

	ScopeAllSecureValues = ScopeProviderSecretSecureValues.GetResourceAllScope()
	ScopeAllKeepers      = ScopeProviderSecretKeepers.GetResourceAllScope()
)

func registerAccessControlRoles(service accesscontrol.Service) error {
	// SecureValues
	// These are broken down into more granular fixed roles on purpose.
	// For inline Secure Values, we want to allow creation and deletion by Editors because there's no API to read/update.
	// References are only available with the API and RBAC, so those roles can be granted to any basic role by Operators.
	secureValuesCreator := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.securevalues:creator",
			DisplayName: "Secure Values Creator",
			Description: "Create secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretSecureValuesCreate,
					Scope:  ScopeAllSecureValues,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	secureValuesReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.securevalues:reader",
			DisplayName: "Secure Values Reader",
			Description: "Read and list secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretSecureValuesRead,
					Scope:  ScopeAllSecureValues,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	secureValuesUpdater := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.securevalues:updater",
			DisplayName: "Secure Values Updater",
			Description: "Update secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretSecureValuesWrite,
					Scope:  ScopeAllSecureValues,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	secureValuesDeleter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.securevalues:deleter",
			DisplayName: "Secure Values Deleter",
			Description: "Delete secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretSecureValuesDelete,
					Scope:  ScopeAllSecureValues,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// Keepers
	keepersReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.keepers:reader",
			DisplayName: "Keepers Reader",
			Description: "Read and list keepers.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretKeepersRead,
					Scope:  ScopeAllKeepers,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	keepersWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.keepers:writer",
			DisplayName: "Keepers Writer",
			Description: "Create, update and delete keepers.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretKeepersCreate,
					Scope:  ScopeAllKeepers,
				},
				{
					Action: ActionSecretKeepersRead,
					Scope:  ScopeAllKeepers,
				},
				{
					Action: ActionSecretKeepersWrite,
					Scope:  ScopeAllKeepers,
				},
				{
					Action: ActionSecretKeepersDelete,
					Scope:  ScopeAllKeepers,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(
		secureValuesCreator,
		secureValuesReader,
		secureValuesUpdater,
		secureValuesDeleter,
		keepersReader,
		keepersWriter,
	)
}
