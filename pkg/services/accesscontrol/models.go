package accesscontrol

import (
	"time"
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
