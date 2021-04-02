package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var builtInRoles = []accesscontrol.RoleDTO{
	{
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: "users:read",
				Scope:      "users:self",
			},
			{
				Permission: "users.tokens:list",
				Scope:      "users:self",
			},
			{
				Permission: "users.teams:read",
				Scope:      "users:self",
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
	for _, r := range builtInRoles {
		if r.Name == role {
			builtInRole = r
			// Do not modify builtInRoles
			return &builtInRole
		}
	}
	return nil
}
