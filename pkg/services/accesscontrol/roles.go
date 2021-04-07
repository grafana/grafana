package accesscontrol

import "github.com/grafana/grafana/pkg/models"

var PredefinedRoles = map[string]RoleDTO{
	usersSelfRead: {
		Name:    usersSelfRead,
		Version: 1,
		Permissions: []Permission{
			{
				Permission: "users:read",
				Scope:      ScopeUsersSelf,
			},
			{
				Permission: "users.tokens:list",
				Scope:      ScopeUsersSelf,
			},
			{
				Permission: "users.teams:read",
				Scope:      ScopeUsersSelf,
			},
		},
	},
	usersAdminRead: {
		Name:    usersAdminRead,
		Version: 1,
		Permissions: []Permission{
			{
				Permission: ActionUsersRead,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersTeamRead,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersAuthTokenList,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersQuotasList,
				Scope:      ScopeUsersAll,
			},
		},
	},
	usersAdminEdit: {
		Name:    usersAdminEdit,
		Version: 1,
		Permissions: []Permission{
			{
				Permission: ActionUsersAuthTokenList,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersPasswordUpdate,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersCreate,
			},
			{
				Permission: ActionUsersWrite,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersDelete,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersEnable,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersDisable,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersPermissionsUpdate,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersLogout,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersAuthTokenUpdate,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersQuotasList,
				Scope:      ScopeUsersAll,
			},
			{
				Permission: ActionUsersQuotasUpdate,
				Scope:      ScopeUsersAll,
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
	RoleGrafanaAdmin: {
		usersAdminRead,
		usersAdminEdit,
	},
}
