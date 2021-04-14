package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const roleGrafanaAdmin = "Grafana Admin"

var builtInRolesMap = map[string]accesscontrol.RoleDTO{
	"grafana:builtin:users:read:self": {
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Action: "users:read",
				Scope:  "users:self",
			},
			{
				Action: "users.tokens:list",
				Scope:  "users:self",
			},
			{
				Action: "users.teams:read",
				Scope:  "users:self",
			},
		},
	},
}

var builtInRoleGrants = map[string][]string{
	"Viewer": {
		"grafana:builtin:users:read:self",
	},
}

func getBuiltInRole(role string) *accesscontrol.RoleDTO {
	var builtInRole accesscontrol.RoleDTO
	if r, ok := builtInRolesMap[role]; ok {
		// Do not modify builtInRoles
		builtInRole = r
		return &builtInRole
	}
	return nil
}
