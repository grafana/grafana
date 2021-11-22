package manager

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

var (
	roleRegistrations = []accesscontrol.RoleRegistration{
		{

			Role: accesscontrol.RoleDTO{
				Version:     1,
				Name:        "fixed:serviceaccounts:writer",
				Description: "Allows user to create, delete or update the serviceaccounts",
				Permissions: []accesscontrol.Permission{
					{
						Action: serviceaccounts.ActionDelete,
						Scope:  serviceaccounts.ScopeAll,
					},
				},
			},
			Grants: []string{"Admin"},
		},
		{
			Role: accesscontrol.RoleDTO{
				Version:     1,
				Name:        "fixed:serviceaccounts:reader",
				Description: "Gives access to create, read, update, delete datasources",
				Permissions: []accesscontrol.Permission{
					{
						Action: serviceaccounts.ActionRead,
						Scope:  serviceaccounts.ScopeAll,
					},
				},
			},
			Grants: []string{string(models.ROLE_ADMIN)},
		},
		{
			Role: accesscontrol.RoleDTO{
				Version:     1,
				Name:        "fixed:serviceaccounts.status:reader",
				Description: "Gives access to read the query from the status endpoint",
				Permissions: []accesscontrol.Permission{
					{
						Action: serviceaccounts.ActionStatusRead,
						Scope:  serviceaccounts.ScopeAll,
					},
				},
			},
			Grants: []string{string(models.ROLE_VIEWER)},
		},
	}
)
