package accesscontrol

import "github.com/grafana/grafana/pkg/models"

var ldapAdminReadRole = RoleDTO{
	Name:    ldapAdminRead,
	Version: 1,
	Permissions: []Permission{
		{
			Action: ActionLDAPUsersRead,
		},
		{
			Action: ActionLDAPStatusRead,
		},
	},
}

var ldapAdminEditRole = RoleDTO{
	Name:    ldapAdminEdit,
	Version: 1,
	Permissions: ConcatPermissions(ldapAdminReadRole.Permissions, []Permission{
		{
			Action: ActionLDAPUsersSync,
		},
	}),
}

var usersOrgReadRole = RoleDTO{
	Name:    usersOrgRead,
	Version: 1,
	Permissions: []Permission{
		{
			Action: ActionOrgUsersRead,
			Scope:  ScopeUsersAll,
		},
	},
}

var usersOrgEditRole = RoleDTO{
	Name:    usersOrgEdit,
	Version: 1,
	Permissions: ConcatPermissions(usersOrgReadRole.Permissions, []Permission{
		{
			Action: ActionOrgUsersAdd,
			Scope:  ScopeUsersAll,
		},
		{
			Action: ActionOrgUsersRoleUpdate,
			Scope:  ScopeUsersAll,
		},
		{
			Action: ActionOrgUsersRemove,
			Scope:  ScopeUsersAll,
		},
	}),
}

var usersAdminReadRole = RoleDTO{
	Name:    usersAdminRead,
	Version: 1,
	Permissions: []Permission{
		{
			Action: ActionUsersRead,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersTeamRead,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersAuthTokenList,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersQuotasList,
			Scope:  ScopeGlobalUsersAll,
		},
	},
}

var usersAdminEditRole = RoleDTO{
	Name:    usersAdminEdit,
	Version: 1,
	Permissions: ConcatPermissions(usersAdminReadRole.Permissions, []Permission{
		{
			Action: ActionUsersPasswordUpdate,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersCreate,
		},
		{
			Action: ActionUsersWrite,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersDelete,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersEnable,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersDisable,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersPermissionsUpdate,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersLogout,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersAuthTokenUpdate,
			Scope:  ScopeGlobalUsersAll,
		},
		{
			Action: ActionUsersQuotasUpdate,
			Scope:  ScopeGlobalUsersAll,
		},
	}),
}

// PredefinedRoles provides a map of permission sets/roles which can be
// assigned to a set of users. When adding a new resource protected by
// Grafana access control the default permissions should be added to a
// new predefined role in this set so that users can access the new
// resource. PredefinedRoleGrants lists which organization roles are
// assigned which predefined roles in this list.
var PredefinedRoles = map[string]RoleDTO{
	usersAdminRead: usersAdminReadRole,
	usersAdminEdit: usersAdminEditRole,

	usersOrgRead: usersOrgReadRole,
	usersOrgEdit: usersOrgEditRole,

	ldapAdminRead: ldapAdminReadRole,
	ldapAdminEdit: ldapAdminEditRole,
}

const (
	usersAdminEdit = "grafana:roles:users:admin:edit"
	usersAdminRead = "grafana:roles:users:admin:read"

	usersOrgEdit = "grafana:roles:users:org:edit"
	usersOrgRead = "grafana:roles:users:org:read"

	ldapAdminEdit = "grafana:roles:ldap:admin:edit"
	ldapAdminRead = "grafana:roles:ldap:admin:read"
)

// PredefinedRoleGrants specifies which organization roles are assigned
// to which set of PredefinedRoles by default. Alphabetically sorted.
var PredefinedRoleGrants = map[string][]string{
	RoleGrafanaAdmin: {
		ldapAdminEdit,
		ldapAdminRead,
		usersAdminEdit,
		usersAdminRead,
		usersOrgEdit,
		usersOrgRead,
	},
	string(models.ROLE_ADMIN): {
		usersOrgEdit,
		usersOrgRead,
	},
}

func ConcatPermissions(permissions ...[]Permission) []Permission {
	if permissions == nil {
		return nil
	}
	perms := make([]Permission, 0)
	for _, p := range permissions {
		pCopy := make([]Permission, 0, len(p))
		copy(pCopy, p)
		perms = append(perms, p...)
	}
	return perms
}
