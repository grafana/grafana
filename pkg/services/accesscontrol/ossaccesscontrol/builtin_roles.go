package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var PredefinedRoles = map[string]accesscontrol.RoleDTO{
	usersSelfRead: {
		Name:    usersSelfRead,
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
	usersAdminRead: {
		Name:    usersAdminRead,
		Version: 1,
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
	usersAdminEdit: {
		Name:    usersAdminEdit,
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
				Scope:      "",
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

const (
	usersSelfRead  = "grafana:roles:users:self:read"
	usersAdminRead = "grafana:roles:users:admin:read"
	usersAdminEdit = "grafana:roles:users:admin:edit"
)

var PredefinedRoleGrants = map[string][]string{
	string(models.ROLE_VIEWER): {
		usersSelfRead,
	},
	accesscontrol.RoleGrafanaAdmin: {
		usersAdminRead,
		usersAdminEdit,
	},
}

func getBuiltInRole(role string) *accesscontrol.RoleDTO {
	var builtInRole accesscontrol.RoleDTO
	if r, ok := PredefinedRoles[role]; ok {
		// Do not modify builtInRoles
		builtInRole = r
		return &builtInRole
	}
	return nil
}
