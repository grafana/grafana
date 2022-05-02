package accesscontrol

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/models"
)

type RoleRegistry interface {
	// RegisterFixedRoles registers all roles declared to AccessControl
	RegisterFixedRoles(ctx context.Context) error
}

// Roles definition
var (
	ldapReaderRole = RoleDTO{
		Name:        "fixed:ldap:reader",
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
		Name:        "fixed:ldap:writer",
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
		Name:        "fixed:org.users:writer",
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
		Name:        "fixed:org.users:reader",
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

	SettingsReaderRole = RoleDTO{
		Name:        "fixed:settings:reader",
		DisplayName: "Setting reader",
		Description: "Read Grafana instance settings.",
		Group:       "Settings",
		Version:     4,
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsAll,
			},
		},
	}

	statsReaderRole = RoleDTO{
		Name:        "fixed:stats:reader",
		DisplayName: "Statistics reader",
		Description: "Read Grafana instance statistics.",
		Group:       "Statistics",
		Version:     3,
		Permissions: []Permission{
			{
				Action: ActionServerStatsRead,
			},
		},
	}

	usersReaderRole = RoleDTO{
		Name:        "fixed:users:reader",
		DisplayName: "User reader",
		Description: "Read all users and their information, such as team memberships, authentication tokens, and quotas.",
		Group:       "User administration (global)",
		Version:     4,
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
		Name:        "fixed:users:writer",
		DisplayName: "User writer",
		Description: "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
		Group:       "User administration (global)",
		Version:     4,
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

// Declare OSS roles to the accesscontrol service
func DeclareFixedRoles(ac AccessControl) error {
	ldapReader := RoleRegistration{
		Role:   ldapReaderRole,
		Grants: []string{RoleGrafanaAdmin},
	}
	ldapWriter := RoleRegistration{
		Role:   ldapWriterRole,
		Grants: []string{RoleGrafanaAdmin},
	}
	orgUsersReader := RoleRegistration{
		Role:   orgUsersReaderRole,
		Grants: []string{RoleGrafanaAdmin, string(models.ROLE_ADMIN)},
	}
	orgUsersWriter := RoleRegistration{
		Role:   orgUsersWriterRole,
		Grants: []string{RoleGrafanaAdmin, string(models.ROLE_ADMIN)},
	}
	settingsReader := RoleRegistration{
		Role:   SettingsReaderRole,
		Grants: []string{RoleGrafanaAdmin},
	}
	statsReader := RoleRegistration{
		Role:   statsReaderRole,
		Grants: []string{RoleGrafanaAdmin},
	}
	usersReader := RoleRegistration{
		Role:   usersReaderRole,
		Grants: []string{RoleGrafanaAdmin},
	}
	usersWriter := RoleRegistration{
		Role:   usersWriterRole,
		Grants: []string{RoleGrafanaAdmin},
	}

	return ac.DeclareFixedRoles(ldapReader, ldapWriter, orgUsersReader, orgUsersWriter,
		settingsReader, statsReader, usersReader, usersWriter)
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

func BuildMacroRoleDefinitions() map[string]*RoleDTO {
	return map[string]*RoleDTO{
		string(models.ROLE_ADMIN): {
			Name:        "grafana:builtins:admin",
			UID:         "grafana_builtins_admin",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(models.ROLE_ADMIN),
			Description: "Admin role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		string(models.ROLE_EDITOR): {
			Name:        "grafana:builtins:editor",
			UID:         "grafana_builtins_editor",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(models.ROLE_EDITOR),
			Description: "Editor role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		string(models.ROLE_VIEWER): {
			Name:        "grafana:builtins:viewer",
			UID:         "grafana_builtins_viewer",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(models.ROLE_VIEWER),
			Description: "Viewer role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		RoleGrafanaAdmin: {
			Name:        "grafana:builtins:grafana_admin",
			UID:         "grafana_builtins_grafana_admin",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: RoleGrafanaAdmin,
			Description: "Grafana Admin role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
	}
}
