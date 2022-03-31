package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Roles definition
var (
	ldapReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:ldap:reader",
		DisplayName: "LDAP reader",
		Description: "Read LDAP configuration and status.",
		Group:       "LDAP",
		Version:     3,
		Permissions: []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionLDAPUsersRead,
			},
			{
				Action: accesscontrol.ActionLDAPStatusRead,
			},
		},
	}

	ldapWriterRole = accesscontrol.RoleDTO{
		Name:        "fixed:ldap:writer",
		DisplayName: "LDAP writer",
		Description: "Read and update LDAP configuration and read LDAP status.",
		Group:       "LDAP",
		Version:     4,
		Permissions: accesscontrol.ConcatPermissions(ldapReaderRole.Permissions, []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionLDAPUsersSync,
			},
			{
				Action: accesscontrol.ActionLDAPConfigReload,
			},
		}),
	}

	orgUsersWriterRole = accesscontrol.RoleDTO{
		Name:        "fixed:org.users:writer",
		DisplayName: "Organization user writer",
		Description: "Within a single organization, add a user, invite a user, read information about a user and their role, remove a user from that organization, or change the role of a user.",
		Group:       "User administration (organizational)",
		Version:     3,
		Permissions: accesscontrol.ConcatPermissions(orgUsersReaderRole.Permissions, []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionOrgUsersAdd,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionOrgUsersRoleUpdate,
				Scope:  accesscontrol.ScopeUsersAll,
			},
			{
				Action: accesscontrol.ActionOrgUsersRemove,
				Scope:  accesscontrol.ScopeUsersAll,
			},
		}),
	}

	orgUsersReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:org.users:reader",
		DisplayName: "Organization user reader",
		Description: "Read users within a single organization.",
		Group:       "User administration (organizational)",
		Version:     3,
		Permissions: []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionOrgUsersRead,
				Scope:  accesscontrol.ScopeUsersAll,
			},
		},
	}

	settingsReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:settings:reader",
		DisplayName: "Setting reader",
		Description: "Read Grafana instance settings.",
		Group:       "Settings",
		Version:     4,
		Permissions: []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionSettingsRead,
				Scope:  accesscontrol.ScopeSettingsAll,
			},
		},
	}

	statsReaderRole = accesscontrol.RoleDTO{
		Version:     3,
		Name:        "fixed:stats:reader",
		DisplayName: "Statistics reader",
		Description: "Read Grafana instance statistics.",
		Group:       "Statistics",
		Permissions: []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionServerStatsRead,
			},
		},
	}

	usersReaderRole = accesscontrol.RoleDTO{
		Name:        "fixed:users:reader",
		DisplayName: "User reader",
		Description: "Read all users and their information, such as team memberships, authentication tokens, and quotas.",
		Group:       "User administration (global)",
		Version:     4,
		Permissions: []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionUsersRead,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersTeamRead,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersAuthTokenList,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersQuotasList,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
		},
	}

	usersWriterRole = accesscontrol.RoleDTO{
		Name:        "fixed:users:writer",
		DisplayName: "User writer",
		Description: "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
		Group:       "User administration (global)",
		Version:     4,
		Permissions: accesscontrol.ConcatPermissions(usersReaderRole.Permissions, []accesscontrol.Permission{
			{
				Action: accesscontrol.ActionUsersPasswordUpdate,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersCreate,
			},
			{
				Action: accesscontrol.ActionUsersWrite,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersDelete,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersEnable,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersDisable,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersPermissionsUpdate,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersLogout,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersAuthTokenUpdate,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
			{
				Action: accesscontrol.ActionUsersQuotasUpdate,
				Scope:  accesscontrol.ScopeGlobalUsersAll,
			},
		}),
	}
)

func (ac *OSSAccessControlService) declareOSSRoles() {
	ldapReader := accesscontrol.RoleRegistration{
		Role:   ldapReaderRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}
	ldapWriter := accesscontrol.RoleRegistration{
		Role:   ldapWriterRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}
	orgUsersReader := accesscontrol.RoleRegistration{
		Role:   orgUsersReaderRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin, string(models.ROLE_ADMIN)},
	}
	orgUsersWriter := accesscontrol.RoleRegistration{
		Role:   orgUsersWriterRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin, string(models.ROLE_ADMIN)},
	}
	settingsReader := accesscontrol.RoleRegistration{
		Role:   settingsReaderRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}
	statsReader := accesscontrol.RoleRegistration{
		Role:   statsReaderRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}
	usersReader := accesscontrol.RoleRegistration{
		Role:   usersReaderRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}
	usersWriter := accesscontrol.RoleRegistration{
		Role:   usersWriterRole,
		Grants: []string{accesscontrol.RoleGrafanaAdmin},
	}

	ac.DeclareFixedRoles(ldapReader, ldapWriter, orgUsersReader, orgUsersWriter,
		settingsReader, statsReader, usersReader, usersWriter)
}
