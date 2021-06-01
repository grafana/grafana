package accesscontrol

import "github.com/grafana/grafana/pkg/models"

var ldapAdminReadRole = RoleDTO{
	Name:        ldapAdminRead,
	Version:     2,
	Description: "Read LDAP information and status.",
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
	Name:        ldapAdminEdit,
	Version:     2,
	Description: "Role to allow users everything ldapAdminReadRole allows and to synchronize Grafana users with an LDAP server.",
	Permissions: ConcatPermissions(ldapAdminReadRole.Permissions, []Permission{
		{
			Action: ActionLDAPUsersSync,
		},
	}),
}

var usersOrgReadRole = RoleDTO{
	Name:        usersOrgRead,
	Version:     2,
	Description: "Role to allow users to list users in a given organization.",
	Permissions: []Permission{
		{
			Action: ActionOrgUsersRead,
			Scope:  ScopeUsersAll,
		},
	},
}

var usersOrgEditRole = RoleDTO{
	Name:        usersOrgEdit,
	Version:     2,
	Description: "Allows every read action for user organizations and in addition allows to administer user organizations.",
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
	Name:        usersAdminRead,
	Version:     2,
	Description: "Role to allow users to list users in a given organization, retrieve the teams they are part of, list their authentication tokens, get their connection quotas.",
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
	Name:        usersAdminEdit,
	Version:     2,
	Description: "Allows every read action for users and in addition allows to administer users.",
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

var provisioningAdminRole = RoleDTO{
	Name:        provisioningAdmin,
	Version:     2,
	Description: "Role to allow users to reload the provisioning configuration files.",
	Permissions: []Permission{
		{
			Action: ActionProvisioningReload,
			Scope:  ScopeServicesAll,
		},
	},
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

	provisioningAdmin: provisioningAdminRole,
}

const (
	usersAdminEdit = "grafana:roles:users:admin:edit"
	usersAdminRead = "grafana:roles:users:admin:read"

	usersOrgEdit = "grafana:roles:users:org:edit"
	usersOrgRead = "grafana:roles:users:org:read"

	ldapAdminEdit = "grafana:roles:ldap:admin:edit"
	ldapAdminRead = "grafana:roles:ldap:admin:read"

	provisioningAdmin = "grafana:roles:provisioning:admin"
)

// PredefinedRoleGrants specifies which organization roles are assigned
// to which set of PredefinedRoles by default. Alphabetically sorted.
var PredefinedRoleGrants = map[string][]string{
	RoleGrafanaAdmin: {
		ldapAdminEdit,
		ldapAdminRead,
		provisioningAdmin,
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
