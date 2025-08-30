package accesscontrol

import (
	// #nosec G505 Used only for generating a 160 bit hash, it's not used for security purposes
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	BasicRolePrefix    = "basic:"
	BasicRoleUIDPrefix = "basic_"

	ExternalServiceRolePrefix    = "extsvc:"
	ExternalServiceRoleUIDPrefix = "extsvc_"

	FixedRolePrefix    = "fixed:"
	FixedRoleUIDPrefix = "fixed_"

	ManagedRolePrefix = "managed:"

	PluginRolePrefix = "plugins:"

	BasicRoleNoneUID  = "basic_none"
	BasicRoleNoneName = "basic:none"

	FixedCloudRolePrefix = "fixed:cloud:"
	FixedCloudViewerRole = "fixed:cloud:viewer"
	FixedCloudEditorRole = "fixed:cloud:editor"
	FixedCloudAdminRole  = "fixed:cloud:admin"

	FixedCloudSupportTicketReader = "fixed:cloud:supportticket:reader"
	FixedCloudSupportTicketEditor = "fixed:cloud:supportticket:editor"
	FixedCloudSupportTicketAdmin  = "fixed:cloud:supportticket:admin"
)

// Roles definition
var (
	ldapReaderRole = RoleDTO{
		Name:        "fixed:ldap:reader",
		DisplayName: "Reader",
		Description: "Read LDAP configuration and status.",
		Group:       "LDAP",
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
		DisplayName: "Writer",
		Description: "Read and update LDAP configuration and read LDAP status.",
		Group:       "LDAP",
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
		DisplayName: "Writer (organizational)",
		Description: "Within a single organization, add a user, invite a user, read information about a user and their role, remove a user from that organization, or change the role of a user.",
		Group:       "User administration",
		Permissions: ConcatPermissions(orgUsersReaderRole.Permissions, []Permission{
			{
				Action: ActionOrgUsersAdd,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionOrgUsersWrite,
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
		DisplayName: "Reader (organizational)",
		Description: "Read users within a single organization.",
		Group:       "User administration",
		Permissions: []Permission{
			{
				Action: ActionOrgUsersRead,
				Scope:  ScopeUsersAll,
			},
			{
				Action: ActionUsersPermissionsRead,
				Scope:  ScopeUsersAll,
			},
		},
	}

	SettingsReaderRole = RoleDTO{
		Name:        "fixed:settings:reader",
		DisplayName: "Reader",
		Description: "Read Grafana instance settings.",
		Group:       "Settings",
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsAll,
			},
		},
	}

	statsReaderRole = RoleDTO{
		Name:        "fixed:stats:reader",
		DisplayName: "Reader",
		Description: "Read Grafana instance statistics.",
		Group:       "Statistics",
		Permissions: []Permission{
			{
				Action: ActionServerStatsRead,
			},
		},
	}

	usersReaderRole = RoleDTO{
		Name:        "fixed:users:reader",
		DisplayName: "Reader (global)",
		Description: "Read all users and their information, such as team memberships, authentication tokens, and quotas.",
		Group:       "User administration",
		Permissions: []Permission{
			{
				Action: ActionUsersRead,
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
		DisplayName: "Writer (global)",
		Description: "Read and update all attributes and settings for all users in Grafana: update user information, read user information, create or enable or disable a user, make a user a Grafana administrator, sign out a user, update a user’s authentication token, or update quotas for all users.",
		Group:       "User administration",
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

	authenticationConfigWriterRole = RoleDTO{
		Name:        "fixed:authentication.config:writer",
		DisplayName: "Authentication config writer",
		Description: "Read and update authentication configuration and access configuration UI.",
		Group:       "Settings",
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsSAML,
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsSAML,
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("azuread"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("azuread"),
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("okta"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("okta"),
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("github"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("github"),
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("gitlab"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("gitlab"),
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("google"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("google"),
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("generic_oauth"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("generic_oauth"),
			},
			{
				Action: ActionSettingsRead,
				Scope:  ScopeSettingsOAuth("ldap"),
			},
			{
				Action: ActionSettingsWrite,
				Scope:  ScopeSettingsOAuth("ldap"),
			},
		},
	}

	generalAuthConfigWriterRole = RoleDTO{
		Name:        "fixed:general.auth.config:writer",
		DisplayName: "General authentication config writer",
		Description: "Read and update the Grafana instance's general authentication configuration.",
		Group:       "Settings",
		Permissions: []Permission{
			{
				Action: ActionSettingsRead,
				Scope:  "settings:auth:oauth_allow_insecure_email_lookup",
			},
			{
				Action: ActionSettingsWrite,
				Scope:  "settings:auth:oauth_allow_insecure_email_lookup",
			},
		},
	}

	usagestatsReaderRole = RoleDTO{
		Name:        "fixed:usagestats:reader",
		DisplayName: "Usage report reader",
		Description: "View usage statistics report",
		Group:       "Statistics",
		Permissions: []Permission{
			{Action: ActionUsageStatsRead},
		},
	}

	resourcePermissionsReaderRole = RoleDTO{
		Name:        "fixed:resourcepermissions:reader",
		DisplayName: "Resource permissions reader",
		Description: "Read resource permissions and roles",
		Group:       "IAM",
		Permissions: []Permission{
			{Action: ActionResourcePermissionsRead, Scope: "resourcepermissions:*"},
			{Action: ActionResourcePermissionsRead, Scope: "resourcepermissions:id:*"},
			{Action: ActionResourcePermissionsRead, Scope: "resourcepermissions:uid:*"},
		},
	}

	resourcePermissionsWriterRole = RoleDTO{
		Name:        "fixed:resourcepermissions:writer",
		DisplayName: "Resource permissions writer",
		Description: "Create, read, update and delete resource permissions and roles",
		Group:       "IAM",
		Permissions: ConcatPermissions(resourcePermissionsReaderRole.Permissions, []Permission{
			{Action: ActionResourcePermissionsCreate, Scope: "resourcepermissions:*"},
			{Action: ActionResourcePermissionsWrite, Scope: "resourcepermissions:*"},
			{Action: ActionResourcePermissionsDelete, Scope: "resourcepermissions:*"},
		}),
	}
)

// Declare OSS roles to the accesscontrol service
func DeclareFixedRoles(service Service, cfg *setting.Cfg) error {
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
		Grants: []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
	}
	orgUsersWriter := RoleRegistration{
		Role:   orgUsersWriterRole,
		Grants: []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
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
	generalAuthConfigWriter := RoleRegistration{
		Role:   generalAuthConfigWriterRole,
		Grants: []string{RoleGrafanaAdmin},
	}
	// TODO: Move to own service when implemented
	authenticationConfigWriter := RoleRegistration{
		Role:   authenticationConfigWriterRole,
		Grants: []string{RoleGrafanaAdmin},
	}

	usageStatsReader := RoleRegistration{
		Role:   usagestatsReaderRole,
		Grants: []string{RoleGrafanaAdmin},
	}

	resourcePermissionsReader := RoleRegistration{
		Role:   resourcePermissionsReaderRole,
		Grants: []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
	}

	resourcePermissionsWriter := RoleRegistration{
		Role:   resourcePermissionsWriterRole,
		Grants: []string{RoleGrafanaAdmin, string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(
		ldapReader, ldapWriter, orgUsersReader, orgUsersWriter,
		settingsReader, statsReader, usersReader, usersWriter,
		authenticationConfigWriter, generalAuthConfigWriter, usageStatsReader,
		resourcePermissionsReader, resourcePermissionsWriter,
	)
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

// PrefixedRoleUID generates a uid from name with the same prefix.
// Generated uid is 28 bytes + length of prefix: <prefix>_base64(sha1(roleName))
func PrefixedRoleUID(roleName string) string {
	prefix := strings.Split(roleName, ":")[0] + "_"

	// #nosec G505 Used only for generating a 160 bit hash, it's not used for security purposes
	hasher := sha1.New()
	hasher.Write([]byte(roleName))

	return fmt.Sprintf("%s%s", prefix, base64.RawURLEncoding.EncodeToString(hasher.Sum(nil)))
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
		if org.RoleType(br) == org.RoleNone {
			return ErrNoneRoleAssignment
		}
		if !org.RoleType(br).IsValid() && br != RoleGrafanaAdmin {
			return ErrInvalidBuiltinRole.Build(ErrInvalidBuiltinRoleData(br))
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

func (m *RegistrationList) Slice() []RoleRegistration {
	m.mx.RLock()
	defer m.mx.RUnlock()
	out := make([]RoleRegistration, len(m.registrations))
	copy(out, m.registrations)
	return out
}

func BuildBasicRoleDefinitions() map[string]*RoleDTO {
	return map[string]*RoleDTO{
		string(org.RoleAdmin): {
			Name:        BasicRolePrefix + "admin",
			UID:         BasicRoleUIDPrefix + "admin",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(org.RoleAdmin),
			Description: "Admin role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		string(org.RoleEditor): {
			Name:        BasicRolePrefix + "editor",
			UID:         BasicRoleUIDPrefix + "editor",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(org.RoleEditor),
			Description: "Editor role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		string(org.RoleViewer): {
			Name:        BasicRolePrefix + "viewer",
			UID:         BasicRoleUIDPrefix + "viewer",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(org.RoleViewer),
			Description: "Viewer role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		string(org.RoleNone): {
			Name:        BasicRolePrefix + "none",
			UID:         BasicRoleUIDPrefix + "none",
			OrgID:       GlobalOrgID,
			Version:     1,
			DisplayName: string(org.RoleNone),
			Description: "None role",
			Group:       "Basic",
			Permissions: []Permission{},
			Hidden:      true,
		},
		RoleGrafanaAdmin: {
			Name:        BasicRolePrefix + "grafana_admin",
			UID:         BasicRoleUIDPrefix + "grafana_admin",
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
