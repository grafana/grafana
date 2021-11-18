package manager

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

var (
	role = accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Version:     2,
			Name:        "fixed:serviceaccounts:writer",
			Description: "",
			Group:       "Service accounts",
			Permissions: []accesscontrol.Permission{
				{
					Action: serviceaccounts.ActionDelete,
					Scope:  serviceaccounts.ScopeAll,
				},
			},
		},
		Grants: []string{"Admin"},
	}
)
