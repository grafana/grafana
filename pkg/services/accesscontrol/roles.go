package accesscontrol

var PredefinedRoles = map[string]RoleDTO{
	// TODO: Add support for inheritance between the predefined roles to
	// make the admin ⊃ editor ⊃ viewer property hold.
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
				// Inherited from grafana:roles:users:admin:read
				Permission: ActionUsersRead,
				Scope:      ScopeUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Permission: ActionUsersTeamRead,
				Scope:      ScopeUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
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
				// Inherited from grafana:roles:users:admin:read
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
	usersAdminRead = "grafana:roles:users:admin:read"
	usersAdminEdit = "grafana:roles:users:admin:edit"
)

var PredefinedRoleGrants = map[string][]string{
	RoleGrafanaAdmin: {
		usersAdminRead,
		usersAdminEdit,
	},
}
