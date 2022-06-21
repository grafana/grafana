package manager

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

func RegisterRoles(ac accesscontrol.AccessControl) error {
	saReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     1,
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
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	saWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     4,
			Name:        "fixed:serviceaccounts:writer",
			DisplayName: "Service accounts writer",
			Description: "Create, delete, read, or query service accounts.",
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
			}),
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}

	if err := ac.DeclareFixedRoles(saReader, saWriter); err != nil {
		return err
	}

	return nil
}
