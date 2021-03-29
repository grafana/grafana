package seeder

import "github.com/grafana/grafana/pkg/services/accesscontrol"

var builtInRoles = []accesscontrol.RoleDTO{
	{
		Name:    "grafana:builtin:users:read:self",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: "users:read",
				Scope:      accesscontrol.ScopeUsersSelf,
			},
			{
				Permission: "users.tokens:list",
				Scope:      accesscontrol.ScopeUsersSelf,
			},
			{
				Permission: "users.teams:read",
				Scope:      accesscontrol.ScopeUsersSelf,
			},
		},
	},
	{
		Name:    "roles:adminUsers:viewer",
		Version: 2,
		Permissions: []accesscontrol.Permission{
			{
				Permission: accesscontrol.ActionUsersAuthTokenList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersQuotasList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
		},
	},
	{
		Name:    "roles:adminUsers:editor",
		Version: 1,
		Permissions: []accesscontrol.Permission{
			{
				Permission: accesscontrol.ActionUsersAuthTokenList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersPasswordUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersCreate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersDelete,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersEnable,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersDisable,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersPermissionsUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersLogout,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersAuthTokenUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersQuotasList,
				Scope:      accesscontrol.ScopeUsersAll,
			},
			{
				Permission: accesscontrol.ActionUsersQuotasUpdate,
				Scope:      accesscontrol.ScopeUsersAll,
			},
		},
	},
}
