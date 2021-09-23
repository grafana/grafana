package accesscontrol

import (
	"encoding/json"
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
	Description string `json:"description"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type RoleDTO struct {
	Version     int64        `json:"version"`
	UID         string       `xorm:"uid" json:"uid"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions,omitempty"`

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
		Description: r.Description,
		Updated:     r.Updated,
		Created:     r.Created,
	}
}

func (r RoleDTO) Global() bool {
	return r.OrgID == GlobalOrgID
}

func (r Role) Global() bool {
	return r.OrgID == GlobalOrgID
}

func (r RoleDTO) MarshalJSON() ([]byte, error) {
	type Alias RoleDTO
	return json.Marshal(&struct {
		Alias
		Global bool `json:"global" xorm:"-"`
	}{
		Alias:  (Alias)(r),
		Global: r.Global(),
	})
}

func (r Role) MarshalJSON() ([]byte, error) {
	type Alias Role
	return json.Marshal(&struct {
		Alias
		Global bool `json:"global" xorm:"-"`
	}{
		Alias:  (Alias)(r),
		Global: r.Global(),
	})
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
)

const RoleGrafanaAdmin = "Grafana Admin"

const FixedRolePrefix = "fixed:"
