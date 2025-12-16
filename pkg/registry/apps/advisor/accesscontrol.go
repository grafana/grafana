package advisor

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	// Check
	ActionAdvisorCheckCreate = "advisor.checks:create" // CREATE.
	ActionAdvisorCheckWrite  = "advisor.checks:write"  // UPDATE.
	ActionAdvisorCheckRead   = "advisor.checks:read"   // GET + LIST.
	ActionAdvisorCheckDelete = "advisor.checks:delete" // DELETE.

	// CheckTypes
	ActionAdvisorCheckTypesCreate = "advisor.checktypes:create" // CREATE.
	ActionAdvisorCheckTypesWrite  = "advisor.checktypes:write"  // UPDATE.
	ActionAdvisorCheckTypesRead   = "advisor.checktypes:read"   // GET + LIST.
	ActionAdvisorCheckTypesDelete = "advisor.checktypes:delete" // DELETE.

	// Register
	ActionAdvisorRegisterCreate = "advisor.register:create" // CREATE (register check types).
)

var (
	ScopeProviderAdvisorCheck      = accesscontrol.NewScopeProvider("advisor.checks")
	ScopeProviderAdvisorCheckTypes = accesscontrol.NewScopeProvider("advisor.checktypes")
	ScopeProviderAdvisorRegister   = accesscontrol.NewScopeProvider("advisor.register")

	ScopeAllAdvisorCheck      = ScopeProviderAdvisorCheck.GetResourceAllScope()
	ScopeAllAdvisorCheckTypes = ScopeProviderAdvisorCheckTypes.GetResourceAllScope()
	ScopeAllAdvisorRegister   = ScopeProviderAdvisorRegister.GetResourceAllScope()
)

func registerAccessControlRoles(service accesscontrol.Service) error {
	// Check
	checkReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:advisor.checks:reader",
			DisplayName: "Advisor Check Reader",
			Description: "Read and list advisor checks.",
			Group:       "Advisor",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionAdvisorCheckRead,
					Scope:  ScopeAllAdvisorCheck,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	checkWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:advisor.checks:writer",
			DisplayName: "Advisor Check Writer",
			Description: "Create, update and delete advisor checks.",
			Group:       "Advisor",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionAdvisorCheckCreate,
					Scope:  ScopeAllAdvisorCheck,
				},
				{
					Action: ActionAdvisorCheckRead,
					Scope:  ScopeAllAdvisorCheck,
				},
				{
					Action: ActionAdvisorCheckWrite,
					Scope:  ScopeAllAdvisorCheck,
				},
				{
					Action: ActionAdvisorCheckDelete,
					Scope:  ScopeAllAdvisorCheck,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// CheckTypes
	checkTypesReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:advisor.checktypes:reader",
			DisplayName: "Advisor Check Types Reader",
			Description: "Read and list advisor check types.",
			Group:       "Advisor",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionAdvisorCheckTypesRead,
					Scope:  ScopeAllAdvisorCheckTypes,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	checkTypesWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:advisor.checktypes:writer",
			DisplayName: "Advisor Check Types Writer",
			Description: "Create, update and delete advisor check types.",
			Group:       "Advisor",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionAdvisorCheckTypesCreate,
					Scope:  ScopeAllAdvisorCheckTypes,
				},
				{
					Action: ActionAdvisorCheckTypesRead,
					Scope:  ScopeAllAdvisorCheckTypes,
				},
				{
					Action: ActionAdvisorCheckTypesWrite,
					Scope:  ScopeAllAdvisorCheckTypes,
				},
				{
					Action: ActionAdvisorCheckTypesDelete,
					Scope:  ScopeAllAdvisorCheckTypes,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// Register
	registerWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:advisor.register:writer",
			DisplayName: "Advisor Register Writer",
			Description: "Register default advisor check types.",
			Group:       "Advisor",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionAdvisorRegisterCreate,
					Scope:  ScopeAllAdvisorRegister,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(
		checkReader,
		checkWriter,
		checkTypesReader,
		checkTypesWriter,
		registerWriter,
	)
}
