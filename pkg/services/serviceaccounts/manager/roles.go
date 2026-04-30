package manager

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

// FixedRoleRegistrations returns the service account role registrations.
func FixedRoleRegistrations() []accesscontrol.RoleRegistration {
	saReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:serviceaccounts:reader",
			DisplayName: "Reader",
			Description: "Read service accounts and service account tokens.",
			Group:       "Service accounts",
			Permissions: []accesscontrol.Permission{
				{
					Action: serviceaccounts.ActionRead,
					Scope:  serviceaccounts.ScopeAll,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	saCreator := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:serviceaccounts:creator",
			DisplayName: "Creator",
			Description: "Create service accounts.",
			Group:       "Service accounts",
			Permissions: []accesscontrol.Permission{
				{
					Action: serviceaccounts.ActionCreate,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	saWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:serviceaccounts:writer",
			DisplayName: "Writer",
			Description: "Create, delete and read service accounts, manage service account permissions.",
			Group:       "Service accounts",
			Permissions: accesscontrol.ConcatPermissions(saReader.Role.Permissions, []accesscontrol.Permission{
				{
					Action: serviceaccounts.ActionWrite,
					Scope:  serviceaccounts.ScopeAll,
				},
				{
					Action: serviceaccounts.ActionCreate,
				},
				{
					Action: serviceaccounts.ActionDelete,
					Scope:  serviceaccounts.ScopeAll,
				},
				{
					Action: serviceaccounts.ActionPermissionsRead,
					Scope:  serviceaccounts.ScopeAll,
				},
				{
					Action: serviceaccounts.ActionPermissionsWrite,
					Scope:  serviceaccounts.ScopeAll,
				},
			}),
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return []accesscontrol.RoleRegistration{saReader, saCreator, saWriter}
}

func RegisterRoles(service accesscontrol.Service) error {
	return service.DeclareFixedRoles(FixedRoleRegistrations()...)
}
