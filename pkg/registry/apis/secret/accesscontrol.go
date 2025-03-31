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

func RegisterAccessControlRoles(service accesscontrol.Service) error {
	// SecureValues
	secureValuesReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.securevalues:reader",
			DisplayName: "Secrets Manager secure values reader",
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

	secureValuesWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:secret.securevalues:writer",
			DisplayName: "Secrets Manager secure values writer",
			Description: "Create, update and delete secure values.",
			Group:       "Secrets Manager",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionSecretSecureValuesCreate,
					Scope:  ScopeAllSecureValues,
				},
				{
					Action: ActionSecretSecureValuesRead,
					Scope:  ScopeAllSecureValues,
				},
				{
					Action: ActionSecretSecureValuesWrite,
					Scope:  ScopeAllSecureValues,
				},
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
			DisplayName: "Secrets Manager keepers reader",
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
			DisplayName: "Secrets Manager keepers writer",
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
		secureValuesReader, secureValuesWriter,
		keepersReader, keepersWriter,
	)
}
