package accesscontrol

import (
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/models"
)

// Roles definition
var (
	datasourcesEditorReadRole = RoleDTO{
		Version: 1,
		Name:    datasourcesEditorRead,
		Permissions: []Permission{
			{
				Action: ActionDatasourcesExplore,
			},
		},
	}

	ldapAdminReadRole = RoleDTO{
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

	ldapAdminEditRole = RoleDTO{
		Name:    ldapAdminEdit,
		Version: 2,
		Permissions: ConcatPermissions(ldapAdminReadRole.Permissions, []Permission{
			{
				Action: ActionLDAPUsersSync,
			},
			{
				Action: ActionLDAPConfigReload,
			},
		}),
	}

	serverAdminReadRole = RoleDTO{
		Version: 1,
		Name:    serverAdminRead,
		Permissions: []Permission{
			{
				Action: ActionServerStatsRead,
			},
		},
	}

	settingsAdminReadRole = RoleDTO{
		Version: 1,
		Name:    settingsAdminRead,
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  RoleScopeSettingsAll,
			},
		},
	}

	usersOrgReadRole = RoleDTO{
		Name:    usersOrgRead,
		Version: 1,
		Permissions: []Permission{
			{
				Action: ActionOrgUsersRead,
				Scope:  RoleScopeUsersAll,
			},
		},
	}

	usersOrgEditRole = RoleDTO{
		Name:    usersOrgEdit,
		Version: 1,
		Permissions: ConcatPermissions(usersOrgReadRole.Permissions, []Permission{
			{
				Action: ActionOrgUsersAdd,
				Scope:  RoleScopeUsersAll,
			},
			{
				Action: ActionOrgUsersRoleUpdate,
				Scope:  RoleScopeUsersAll,
			},
			{
				Action: ActionOrgUsersRemove,
				Scope:  RoleScopeUsersAll,
			},
		}),
	}

	usersAdminReadRole = RoleDTO{
		Name:    usersAdminRead,
		Version: 1,
		Permissions: []Permission{
			{
				Action: ActionUsersRead,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersTeamRead,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersAuthTokenList,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersQuotasList,
				Scope:  RoleScopeGlobalUsersAll,
			},
		},
	}

	usersAdminEditRole = RoleDTO{
		Name:    usersAdminEdit,
		Version: 1,
		Permissions: ConcatPermissions(usersAdminReadRole.Permissions, []Permission{
			{
				Action: ActionUsersPasswordUpdate,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersCreate,
			},
			{
				Action: ActionUsersWrite,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersDelete,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersEnable,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersDisable,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersPermissionsUpdate,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersLogout,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersAuthTokenUpdate,
				Scope:  RoleScopeGlobalUsersAll,
			},
			{
				Action: ActionUsersQuotasUpdate,
				Scope:  RoleScopeGlobalUsersAll,
			},
		}),
	}
)

// Role names definitions
const (
	datasourcesEditorRead = "fixed:datasources:editor:read"

	serverAdminRead = "fixed:server:admin:read"

	settingsAdminRead = "fixed:settings:admin:read"

	usersAdminEdit = "fixed:users:admin:edit"
	usersAdminRead = "fixed:users:admin:read"

	usersOrgEdit = "fixed:users:org:edit"
	usersOrgRead = "fixed:users:org:read"

	ldapAdminEdit = "fixed:ldap:admin:edit"
	ldapAdminRead = "fixed:ldap:admin:read"
)

var (
	// FixedRoles provides a map of permission sets/roles which can be
	// assigned to a set of users. When adding a new resource protected by
	// Grafana access control the default permissions should be added to a
	// new fixed role in this set so that users can access the new
	// resource. FixedRoleGrants lists which built-in roles are
	// assigned which fixed roles in this list.
	FixedRoles = map[string]RoleDTO{
		datasourcesEditorRead: datasourcesEditorReadRole,
		usersAdminEdit:        usersAdminEditRole,
		usersAdminRead:        usersAdminReadRole,
		usersOrgEdit:          usersOrgEditRole,
		usersOrgRead:          usersOrgReadRole,
		ldapAdminEdit:         ldapAdminEditRole,
		ldapAdminRead:         ldapAdminReadRole,
		serverAdminRead:       serverAdminReadRole,
		settingsAdminRead:     settingsAdminReadRole,
	}

	// FixedRoleGrants specifies which built-in roles are assigned
	// to which set of FixedRoles by default. Alphabetically sorted.
	FixedRoleGrants = map[string][]string{
		RoleGrafanaAdmin: {
			ldapAdminEdit,
			ldapAdminRead,
			serverAdminRead,
			settingsAdminRead,
			usersAdminEdit,
			usersAdminRead,
			usersOrgEdit,
			usersOrgRead,
		},
		string(models.ROLE_ADMIN): {
			usersOrgEdit,
			usersOrgRead,
		},
		string(models.ROLE_EDITOR): {
			datasourcesEditorRead,
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
