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
	Permissions: concat(ldapAdminReadRole.Permissions, []Permission{
		{
			Action: ActionLDAPUsersSync,
		},
	}),
}

var orgsAdminReadRole = RoleDTO{
	Name:    orgsAdminRead,
	Version: 1,
	Permissions: []Permission{
		{
			Action: ActionOrgUsersRead,
			Scope:  ScopeOrgAllUsersAll,
		},
	},
}

var orgsAdminEditRole = RoleDTO{
	Name:    orgsAdminEdit,
	Version: 1,
	Permissions: concat(orgsAdminReadRole.Permissions, []Permission{
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
	}),
}

var orgsCurrentReadRole = RoleDTO{
	Name:    orgsCurrentRead,
	Version: 1,
	Permissions: []Permission{
		{
			Action: ActionOrgUsersRead,
			Scope:  ScopeOrgCurrentUsersAll,
		},
	},
}

var orgsCurrentEditRole = RoleDTO{
	Name:    orgsCurrentEdit,
	Version: 1,
	Permissions: concat(orgsCurrentReadRole.Permissions, []Permission{
		{
			Action: ActionOrgUsersAdd,
			Scope:  ScopeOrgCurrentUsersAll,
		},
		{
			Action: ActionOrgUsersRoleUpdate,
			Scope:  ScopeOrgCurrentUsersAll,
		},
		{
			Action: ActionOrgUsersRemove,
			Scope:  ScopeOrgCurrentUsersAll,
		},
	}),
}

var usersAdminReadRole = RoleDTO{
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
	},
}

var usersAdminEditRole = RoleDTO{
	Name:    usersAdminEdit,
	Version: 1,
	Permissions: concat(usersAdminReadRole.Permissions, []Permission{
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
			Action: ActionUsersQuotasUpdate,
			Scope:  ScopeUsersAll,
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

	orgsAdminRead: orgsAdminReadRole,
	orgsAdminEdit: orgsAdminEditRole,

	orgsCurrentRead: orgsCurrentReadRole,
	orgsCurrentEdit: orgsCurrentEditRole,

	ldapAdminRead: ldapAdminReadRole,
	ldapAdminEdit: ldapAdminEditRole,
}

const (
	usersAdminEdit = "grafana:roles:users:admin:edit"
	usersAdminRead = "grafana:roles:users:admin:read"

	orgsAdminEdit = "grafana:roles:orgs:admin:edit"
	orgsAdminRead = "grafana:roles:orgs:admin:read"

	orgsCurrentEdit = "grafana:roles:orgs:current:edit"
	orgsCurrentRead = "grafana:roles:orgs:current:read"

	ldapAdminEdit = "grafana:roles:ldap:admin:edit"
	ldapAdminRead = "grafana:roles:ldap:admin:read"
)

// PredefinedRoleGrants specifies which organization roles are assigned
// to which set of PredefinedRoles by default. Alphabetically sorted.
var PredefinedRoleGrants = map[string][]string{
	RoleGrafanaAdmin: {
		ldapAdminEdit,
		ldapAdminRead,
		orgsAdminEdit,
		orgsAdminRead,
		usersAdminEdit,
		usersAdminRead,
	},
	string(models.ROLE_ADMIN): {
		orgsCurrentEdit,
		orgsCurrentRead,
	},
}

func concat(permissions ...[]Permission) []Permission {
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
