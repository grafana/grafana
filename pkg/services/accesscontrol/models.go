package accesscontrol

import (
	"errors"
	"time"
)

var (
	ErrRoleNotFound                = errors.New("role not found")
	ErrTeamRoleAlreadyAdded        = errors.New("role is already added to this team")
	ErrUserRoleAlreadyAdded        = errors.New("role is already added to this user")
	ErrTeamRoleNotFound            = errors.New("team role not found")
	ErrUserRoleNotFound            = errors.New("user role not found")
	ErrTeamNotFound                = errors.New("team not found")
	ErrPermissionNotFound          = errors.New("permission not found")
	ErrRoleFailedGenerateUniqueUID = errors.New("failed to generate role definition UID")
	ErrVersionLE                   = errors.New("the provided role version is smaller than or equal to stored role")
)

// Role is the model for Role in RBAC.
type Role struct {
	ID          int64  `json:"id" xorm:"pk autoincr 'id'"`
	OrgID       int64  `json:"orgId" xorm:"org_id"`
	Version     int64  `json:"version"`
	UID         string `xorm:"uid" json:"uid"`
	Name        string `json:"name"`
	Description string `json:"description"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type RoleDTO struct {
	ID          int64        `json:"id" xorm:"pk autoincr 'id'"`
	OrgID       int64        `json:"orgId" xorm:"org_id"`
	Version     int64        `json:"version"`
	UID         string       `xorm:"uid" json:"uid"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions,omitempty"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

// Permission is the model for Permission in RBAC.
type Permission struct {
	ID         int64  `json:"id" xorm:"pk autoincr 'id'"`
	RoleID     int64  `json:"-" xorm:"role_id"`
	Permission string `json:"permission"`
	Scope      string `json:"scope"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type GetUserPermissionsQuery struct {
	OrgID  int64 `json:"-"`
	UserID int64 `json:"userId"`
	Roles  []string
}

type EvaluationResult struct {
	HasAccess bool
	Meta      interface{}
}

func (p RoleDTO) Role() Role {
	return Role{
		ID:          p.ID,
		OrgID:       p.OrgID,
		Name:        p.Name,
		Description: p.Description,
		Updated:     p.Updated,
		Created:     p.Created,
	}
}
