package accesscontrol

import (
	"encoding/json"
	"strings"
	"time"
)

// RoleRegistration stores a role and its assignments to built-in roles
// (Viewer, Editor, Admin, Grafana Admin)
type RoleRegistration struct {
	Role   RoleDTO
	Grants []string
}

// Role is the model for Role in RBAC.
type Role struct {
	ID          int64  `json:"-" xorm:"pk autoincr 'id'"`
	OrgID       int64  `json:"-" xorm:"org_id"`
	Version     int64  `json:"version"`
	UID         string `xorm:"uid" json:"uid"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Group       string `xorm:"group_name" json:"group"`
	Description string `json:"description"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

func (r Role) Global() bool {
	return r.OrgID == GlobalOrgID
}

func (r Role) IsFixed() bool {
	return strings.HasPrefix(r.Name, FixedRolePrefix)
}

func (r Role) GetDisplayName() string {
	if r.IsFixed() && r.DisplayName == "" {
		r.DisplayName = fallbackDisplayName(r.Name)
	}
	return r.DisplayName
}

func (r Role) MarshalJSON() ([]byte, error) {
	type Alias Role

	r.DisplayName = r.GetDisplayName()
	return json.Marshal(&struct {
		Alias
		Global bool `json:"global" xorm:"-"`
	}{
		Alias:  (Alias)(r),
		Global: r.Global(),
	})
}

type RoleDTO struct {
	Version     int64        `json:"version"`
	UID         string       `xorm:"uid" json:"uid"`
	Name        string       `json:"name"`
	DisplayName string       `json:"displayName"`
	Description string       `json:"description"`
	Group       string       `xorm:"group_name" json:"group"`
	Permissions []Permission `json:"permissions,omitempty"`
	Delegatable *bool        `json:"delegatable,omitempty"`

	ID    int64 `json:"-" xorm:"pk autoincr 'id'"`
	OrgID int64 `json:"-" xorm:"org_id"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

func (r RoleDTO) Role() Role {
	return Role{
		ID:          r.ID,
		OrgID:       r.OrgID,
		UID:         r.UID,
		Name:        r.Name,
		DisplayName: r.DisplayName,
		Group:       r.Group,
		Description: r.Description,
		Updated:     r.Updated,
		Created:     r.Created,
	}
}

func (r RoleDTO) Global() bool {
	return r.OrgID == GlobalOrgID
}

func (r RoleDTO) IsFixed() bool {
	return strings.HasPrefix(r.Name, FixedRolePrefix)
}

func (r RoleDTO) GetDisplayName() string {
	if r.IsFixed() && r.DisplayName == "" {
		r.DisplayName = fallbackDisplayName(r.Name)
	}
	if r.DisplayName == "" {
		return r.Name
	}
	return r.DisplayName
}

func (r RoleDTO) MarshalJSON() ([]byte, error) {
	type Alias RoleDTO

	r.DisplayName = r.GetDisplayName()
	return json.Marshal(&struct {
		Alias
		Global bool `json:"global" xorm:"-"`
	}{
		Alias:  (Alias)(r),
		Global: r.Global(),
	})
}

// fallbackDisplayName provides a fallback name for role
// that can be displayed in the ui for better readability
// example: currently this would give:
// fixed:datasources:name -> datasources name
// datasources:admin      -> datasources admin
func fallbackDisplayName(rName string) string {
	// removing prefix for fixed roles
	rNameWithoutPrefix := strings.Replace(rName, FixedRolePrefix, "", 1)
	return strings.TrimSpace(strings.Replace(rNameWithoutPrefix, ":", " ", -1))
}

type TeamRole struct {
	ID     int64 `json:"id" xorm:"pk autoincr 'id'"`
	OrgID  int64 `json:"orgId" xorm:"org_id"`
	RoleID int64 `json:"roleId" xorm:"role_id"`
	TeamID int64 `json:"teamId" xorm:"team_id"`

	Created time.Time
}

type UserRole struct {
	ID     int64 `json:"id" xorm:"pk autoincr 'id'"`
	OrgID  int64 `json:"orgId" xorm:"org_id"`
	RoleID int64 `json:"roleId" xorm:"role_id"`
	UserID int64 `json:"userId" xorm:"user_id"`

	Created time.Time
}

type BuiltinRole struct {
	ID     int64 `json:"id" xorm:"pk autoincr 'id'"`
	RoleID int64 `json:"roleId" xorm:"role_id"`
	OrgID  int64 `json:"orgId" xorm:"org_id"`
	Role   string

	Updated time.Time
	Created time.Time
}

// Permission is the model for access control permissions.
type Permission struct {
	ID     int64  `json:"-" xorm:"pk autoincr 'id'"`
	RoleID int64  `json:"-" xorm:"role_id"`
	Action string `json:"action"`
	Scope  string `json:"scope"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

func (p Permission) OSSPermission() Permission {
	return Permission{
		Action: p.Action,
		Scope:  p.Scope,
	}
}

type GetUserPermissionsQuery struct {
	OrgID  int64 `json:"-"`
	UserID int64 `json:"userId"`
	Roles  []string
}

// ScopeParams holds the parameters used to fill in scope templates
type ScopeParams struct {
	OrgID     int64
	URLParams map[string]string
}

// ResourcePermission is structure that holds all actions that either a team / user / builtin-role
// can perform against specific resource.
type ResourcePermission struct {
	ID          int64
	ResourceID  string
	RoleName    string
	Actions     []string
	Scope       string
	UserId      int64
	UserLogin   string
	UserEmail   string
	TeamId      int64
	TeamEmail   string
	Team        string
	BuiltInRole string
	Created     time.Time
	Updated     time.Time
}

func (p *ResourcePermission) IsManaged() bool {
	return strings.HasPrefix(p.RoleName, "managed:")
}

func (p *ResourcePermission) Contains(targetActions []string) bool {
	if len(p.Actions) < len(targetActions) {
		return false
	}

	var contain = func(arr []string, s string) bool {
		for _, item := range arr {
			if item == s {
				return true
			}
		}
		return false
	}

	for _, a := range targetActions {
		if !contain(p.Actions, a) {
			return false
		}
	}

	return true
}

type SetResourcePermissionCommand struct {
	Actions    []string
	Resource   string
	ResourceID string
}

type GetResourcesPermissionsQuery struct {
	Actions     []string
	Resource    string
	ResourceIDs []string
	OnlyManaged bool
}

const (
	GlobalOrgID = 0
	// Permission actions

	// Users actions
	ActionUsersRead     = "users:read"
	ActionUsersWrite    = "users:write"
	ActionUsersTeamRead = "users.teams:read"
	// We can ignore gosec G101 since this does not contain any credentials.
	// nolint:gosec
	ActionUsersAuthTokenList = "users.authtoken:list"
	// We can ignore gosec G101 since this does not contain any credentials.
	// nolint:gosec
	ActionUsersAuthTokenUpdate = "users.authtoken:update"
	// We can ignore gosec G101 since this does not contain any credentials.
	// nolint:gosec
	ActionUsersPasswordUpdate    = "users.password:update"
	ActionUsersDelete            = "users:delete"
	ActionUsersCreate            = "users:create"
	ActionUsersEnable            = "users:enable"
	ActionUsersDisable           = "users:disable"
	ActionUsersPermissionsUpdate = "users.permissions:update"
	ActionUsersLogout            = "users:logout"
	ActionUsersQuotasList        = "users.quotas:list"
	ActionUsersQuotasUpdate      = "users.quotas:update"

	// Org actions
	ActionOrgUsersRead       = "org.users:read"
	ActionOrgUsersAdd        = "org.users:add"
	ActionOrgUsersRemove     = "org.users:remove"
	ActionOrgUsersRoleUpdate = "org.users.role:update"

	// LDAP actions
	ActionLDAPUsersRead    = "ldap.user:read"
	ActionLDAPUsersSync    = "ldap.user:sync"
	ActionLDAPStatusRead   = "ldap.status:read"
	ActionLDAPConfigReload = "ldap.config:reload"

	// Server actions
	ActionServerStatsRead = "server.stats:read"

	// Settings actions
	ActionSettingsRead = "settings:read"

	// Datasources actions
	ActionDatasourcesExplore = "datasources:explore"

	// Plugin actions
	ActionPluginsManage = "plugins:manage"

	// Global Scopes
	ScopeGlobalUsersAll = "global:users:*"

	// Users scope
	ScopeUsersAll = "users:*"

	// Settings scope
	ScopeSettingsAll = "settings:*"

	// Licensing related actions
	ActionLicensingRead        = "licensing:read"
	ActionLicensingUpdate      = "licensing:update"
	ActionLicensingDelete      = "licensing:delete"
	ActionLicensingReportsRead = "licensing.reports:read"

	// Team actions
	ActionTeamsCreate = "teams:create"
)

const RoleGrafanaAdmin = "Grafana Admin"

const FixedRolePrefix = "fixed:"

// LicensingPageReaderAccess defines permissions that grant access to the licensing and stats page
var LicensingPageReaderAccess = EvalAny(
	EvalPermission(ActionLicensingRead),
	EvalPermission(ActionServerStatsRead),
)
