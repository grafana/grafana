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
	datasourcesQuerierRole = RoleDTO{
		Version:     2,
		Name:        datasourcesQuerier,
		DisplayName: "Data sources querier",
		Description: "Query data sources using the Explore feature in Grafana. Users will only be able to query datasources for which they also have data source query permissions.",
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
		Version:     2,
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
		Version:     3,
		Permissions: ConcatPermissions(ldapReaderRole.Permissions, []Permission{
			{
				Action: ActionLDAPUsersSync,
			},
			{
				Action: ActionLDAPConfigReload,
			},
		}),
	}

	statsReaderRole = RoleDTO{
		Version:     2,
		Name:        statsReader,
		DisplayName: "Stats reader",
		Description: "Read [server stats](https://grafana.com/docs/grafana/latest/administration/view-server/view-server-stats/).",
		Permissions: []Permission{
			{
				Action: ActionServerStatsRead,
			},
		},
	}

	settingsReaderRole = RoleDTO{
		Version:     3,
		DisplayName: "Settings reader",
		Description: "Read settings, as on the /admin/settings page in Grafana.",
		Name:        settingsReader,
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsAll,
			},
		},
	}

	orgUsersReaderRole = RoleDTO{
		Name:        orgUsersReader,
		DisplayName: "Organization users reader",
		Description: "Read users in organization",
		Version:     2,
		Permissions: []Permission{
			{
				Action: ActionOrgUsersRead,
				Scope:  ScopeUsersAll,
			},
		},
	}

	orgUsersWriterRole = RoleDTO{
		Name:        orgUsersWriter,
		DisplayName: "Organization users writer",
		Description: "Read, add, remove and update role for users in organization",
		Version:     2,
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

	usersReaderRole = RoleDTO{
		Name:        usersReader,
		DisplayName: "Users reader",
		Description: "Read all users and their information, such as team membership, authentication tokens, and quotas.",
		Version:     2,
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
		DisplayName: "Users writer",
		Description: "Read and update all attributes and settings for all users in Grafana.",
		Version:     2,
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
	datasourcesQuerier = "fixed:datasources:querier"
	statsReader        = "fixed:stats:reader"
	settingsReader     = "fixed:settings:reader"
	usersWriter        = "fixed:users:writer"
	usersReader        = "fixed:users:reader"
	orgUsersWriter     = "fixed:org:users:writer"
	orgUsersReader     = "fixed:org:users:reader"
	ldapWriter         = "fixed:ldap:writer"
	ldapReader         = "fixed:ldap:reader"
)

var (
	// FixedRoles provides a map of permission sets/roles which can be
	// assigned to a set of users. When adding a new resource protected by
	// Grafana access control the default permissions should be added to a
	// new fixed role in this set so that users can access the new
	// resource. FixedRoleGrants lists which built-in roles are
	// assigned which fixed roles in this list.
	FixedRoles = map[string]RoleDTO{
		datasourcesQuerier: datasourcesQuerierRole,
		usersWriter:        usersWriterRole,
		usersReader:        usersReaderRole,
		orgUsersWriter:     orgUsersWriterRole,
		orgUsersReader:     orgUsersReaderRole,
		ldapWriter:         ldapWriterRole,
		ldapReader:         ldapReaderRole,
		statsReader:        statsReaderRole,
		settingsReader:     settingsReaderRole,
	}

	// FixedRoleGrants specifies which built-in roles are assigned
	// to which set of FixedRoles by default. Alphabetically sorted.
	FixedRoleGrants = map[string][]string{
		RoleGrafanaAdmin: {
			ldapWriter,
			ldapReader,
			statsReader,
			settingsReader,
			usersWriter,
			usersReader,
			orgUsersWriter,
			orgUsersReader,
		},
		string(models.ROLE_ADMIN): {
			orgUsersWriter,
			orgUsersReader,
		},
		string(models.ROLE_EDITOR): {
			datasourcesQuerier,
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
