package manager

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func RegisterRoles(service accesscontrol.Service) error {
	saReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:serviceaccounts:reader",
			DisplayName: "Service accounts reader",
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
			DisplayName: "Service accounts creator",
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
			DisplayName: "Service accounts writer",
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

	if err := service.DeclareFixedRoles(saReader, saCreator, saWriter); err != nil {
		return err
	}

	return nil
}
