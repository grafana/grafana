package accesscontrol

// PredefinedRoles provides a map of permission sets/roles which can be
// assigned to a set of users. When adding a new resource protected by
// Grafana access control the default permissions should be added to a
// new predefined role in this set so that users can access the new
// resource. PredefinedRoleGrants lists which organization roles are
// assigned which predefined roles in this list.
var PredefinedRoles = map[string]RoleDTO{
	// TODO: Add support for inheritance between the predefined roles to
	// make the admin ⊃ editor ⊃ viewer property hold.
	usersAdminRead: {
		Name:    usersAdminRead,
		Version: 1,
		Permissions: []Permission{
			{
				Action: ActionUsersRead,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersTeamRead,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersAuthTokenList,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersQuotasList,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionOrgUsersRead,
				Scope:  ScopeOrgAllUsersAll,
			},
			{
				Action: ActionLDAPUsersRead,
			},
			{
				Action: ActionLDAPStatusRead,
			},
		},
	},
	usersAdminEdit: {
		Name:    usersAdminEdit,
		Version: 1,
		Permissions: []Permission{
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionUsersRead,
				Scope:  ScopeUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionUsersTeamRead,
				Scope:  ScopeUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionUsersAuthTokenList,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersPasswordUpdate,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersCreate,
			},
			{
				Action: ActionUsersWrite,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersDelete,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersEnable,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersDisable,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersPermissionsUpdate,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersLogout,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersAuthTokenUpdate,
				Scope:  ScopeUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionUsersQuotasList,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersQuotasUpdate,
				Scope:  ScopeUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionOrgUsersRead,
				Scope:  ScopeOrgAllUsersAll,
			},
			{
				Action: ActionOrgUsersAdd,
				Scope:  ScopeOrgAllUsersAll,
			},
			{
				Action: ActionOrgUsersRemove,
				Scope:  ScopeOrgAllUsersAll,
			},
			{
				Action: ActionOrgUsersRoleUpdate,
				Scope:  ScopeOrgAllUsersAll,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionLDAPUsersRead,
			},
			{
				// Inherited from grafana:roles:users:admin:read
				Action: ActionLDAPStatusRead,
			},
			{
				Action: ActionLDAPUsersSync,
			},
		},
	},
}

const (
	usersAdminEdit = "grafana:roles:users:admin:edit"
	usersAdminRead = "grafana:roles:users:admin:read"
)

// PredefinedRoleGrants specifies which organization roles are assigned
// to which set of PredefinedRoles by default. Alphabetically sorted.
var PredefinedRoleGrants = map[string][]string{
	RoleGrafanaAdmin: {
		usersAdminEdit,
		usersAdminRead,
	},
}
