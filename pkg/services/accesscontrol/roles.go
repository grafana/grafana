package accesscontrol

import (
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/models"
)

type RoleRegistry interface {
	// RegisterFixedRoles registers all roles declared to AccessControl
	RegisterFixedRoles() error
}

// Roles definition
var (
	datasourcesExplorerRole = RoleDTO{
		Version:     3,
		Name:        datasourcesExplorer,
		DisplayName: "Data source explorer",
		Description: "Enable the Explore feature. Data source permissions still apply; you can only query data sources for which you have query permissions.",
		Group:       "Data sources",
		Permissions: []Permission{
			{
				Action: ActionDatasourcesExplore,
			},
		},
	}

	ldapReaderRole = RoleDTO{
		Name:        ldapReader,
		DisplayName: "LDAP reader",
		Description: "Read LDAP configuration and status.",
		Group:       "LDAP",
		Version:     3,
		Permissions: []Permission{
			{
				Action: ActionLDAPUsersRead,
			},
			{
				Action: ActionLDAPStatusRead,
			},
		},
	}

	ldapWriterRole = RoleDTO{
		Name:        ldapWriter,
		DisplayName: "LDAP writer",
		Description: "Read and update LDAP configuration and read LDAP status.",
		Group:       "LDAP",
		Version:     4,
		Permissions: ConcatPermissions(ldapReaderRole.Permissions, []Permission{
			{
				Action: ActionLDAPUsersSync,
			},
			{
				Action: ActionLDAPConfigReload,
			},
		}),
	}

	orgUsersWriterRole = RoleDTO{
		Name:        orgUsersWriter,
		DisplayName: "Organization user writer",
		Description: "Within a single organization, add a user, invite a user, read information about a user and their role, remove a user from that organization, or change the role of a user.",
		Group:       "User administration (organizational)",
		Version:     3,
		Permissions: ConcatPermissions(orgUsersReaderRole.Permissions, []Permission{
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

	orgUsersReaderRole = RoleDTO{
		Name:        orgUsersReader,
		DisplayName: "Organization user reader",
		Description: "Read users within a single organization.",
		Group:       "User administration (organizational)",
		Version:     3,
		Permissions: []Permission{
			{
				Action: ActionOrgUsersRead,
				Scope:  ScopeUsersAll,
			},
		},
	}

	settingsReaderRole = RoleDTO{
		Version:     4,
		DisplayName: "Setting reader",
		Description: "Read Grafana instance settings.",
		Group:       "Settings",
		Name:        settingsReader,
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsAll,
			},
		},
	}

	statsReaderRole = RoleDTO{
		Version:     3,
		Name:        statsReader,
		DisplayName: "Statistics reader",
		Description: "Read Grafana instance statistics.",
		Group:       "Statistics",
		Permissions: []Permission{
			{
				Action: ActionServerStatsRead,
			},
		},
	}

	usersReaderRole = RoleDTO{
		Name:        usersReader,
		DisplayName: "User reader",
		Description: "Read all users and their information, such as team memberships, authentication tokens, and quotas.",
		Group:       "User administration (global)",
		Version:     3,
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

	usersWriterRole = RoleDTO{
		Name:        usersWriter,
		DisplayName: "User writer",
		Description: "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
		Group:       "User administration (global)",
		Version:     3,
		Permissions: ConcatPermissions(usersReaderRole.Permissions, []Permission{
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
)

// Role names definitions
const (
	datasourcesExplorer = "fixed:datasources:explorer"
	ldapReader          = "fixed:ldap:reader"
	ldapWriter          = "fixed:ldap:writer"
	orgUsersReader      = "fixed:org.users:reader"
	orgUsersWriter      = "fixed:org.users:writer"
	settingsReader      = "fixed:settings:reader"
	statsReader         = "fixed:stats:reader"
	usersReader         = "fixed:users:reader"
	usersWriter         = "fixed:users:writer"
)

var (
	// FixedRoles provides a map of permission sets/roles which can be
	// assigned to a set of users. When adding a new resource protected by
	// Grafana access control the default permissions should be added to a
	// new fixed role in this set so that users can access the new
	// resource. FixedRoleGrants lists which built-in roles are
	// assigned which fixed roles in this list.
	FixedRoles = map[string]RoleDTO{
		datasourcesExplorer: datasourcesExplorerRole,
		ldapReader:          ldapReaderRole,
		ldapWriter:          ldapWriterRole,
		orgUsersReader:      orgUsersReaderRole,
		orgUsersWriter:      orgUsersWriterRole,
		settingsReader:      settingsReaderRole,
		statsReader:         statsReaderRole,
		usersReader:         usersReaderRole,
		usersWriter:         usersWriterRole,
	}

	// FixedRoleGrants specifies which built-in roles are assigned
	// to which set of FixedRoles by default. Alphabetically sorted.
	FixedRoleGrants = map[string][]string{
		RoleGrafanaAdmin: {
			ldapReader,
			ldapWriter,
			orgUsersReader,
			orgUsersWriter,
			settingsReader,
			statsReader,
			usersReader,
			usersWriter,
		},
		string(models.ROLE_ADMIN): {
			orgUsersReader,
			orgUsersWriter,
		},
		string(models.ROLE_EDITOR): {
			datasourcesExplorer,
		},
	}
)

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

// ValidateFixedRole errors when a fixed role does not match expected pattern
func ValidateFixedRole(role RoleDTO) error {
	if !strings.HasPrefix(role.Name, FixedRolePrefix) {
		return ErrFixedRolePrefixMissing
	}
	return nil
}

// ValidateBuiltInRoles errors when a built-in role does not match expected pattern
func ValidateBuiltInRoles(builtInRoles []string) error {
	for _, br := range builtInRoles {
		if !models.RoleType(br).IsValid() && br != RoleGrafanaAdmin {
			return fmt.Errorf("'%s' %w", br, ErrInvalidBuiltinRole)
		}
	}
	return nil
}

type RegistrationList struct {
	mx            sync.RWMutex
	registrations []RoleRegistration
}

func (m *RegistrationList) Append(regs ...RoleRegistration) {
	m.mx.Lock()
	defer m.mx.Unlock()
	m.registrations = append(m.registrations, regs...)
}

func (m *RegistrationList) Range(f func(registration RoleRegistration) bool) {
	m.mx.RLock()
	defer m.mx.RUnlock()
	for _, registration := range m.registrations {
		if ok := f(registration); !ok {
			return
		}
	}
}
