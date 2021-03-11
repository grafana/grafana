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
	Id          int64  `json:"id"`
	OrgId       int64  `json:"orgId"`
	Version     int64  `json:"version"`
	UID         string `xorm:"uid" json:"uid"`
	Name        string `json:"name"`
	Description string `json:"description"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type RoleDTO struct {
	Id          int64        `json:"id"`
	OrgId       int64        `json:"orgId"`
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
	Id         int64  `json:"id"`
	RoleId     int64  `json:"-"`
	Permission string `json:"permission"`
	Scope      string `json:"scope"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type TeamRole struct {
	Id     int64
	OrgId  int64
	RoleId int64
	TeamId int64

	Created time.Time
}

type UserRole struct {
	Id     int64
	OrgId  int64
	RoleId int64
	UserId int64

	Created time.Time
}

type BuiltinRole struct {
	ID     *int64 `xorm:"id"`
	RoleID int64  `xorm:"role_id"`
	Role   string

	Updated time.Time
	Created time.Time
}

type GetTeamRolesQuery struct {
	OrgId  int64 `json:"-"`
	TeamId int64
}

type GetUserRolesQuery struct {
	OrgId  int64 `json:"-"`
	UserId int64
	Roles  []string
}

type GetUserPermissionsQuery struct {
	OrgId  int64 `json:"-"`
	UserId int64
	Roles  []string
}

type CreatePermissionCommand struct {
	RoleId     int64
	Permission string
	Scope      string
}

type UpdatePermissionCommand struct {
	Id         int64
	Permission string
	Scope      string
}

type DeletePermissionCommand struct {
	Id int64
}

type CreateRoleCommand struct {
	OrgId       int64  `json:"-"`
	UID         string `json:"uid"`
	Version     int64  `json:"version"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreateRoleWithPermissionsCommand struct {
	OrgId       int64        `json:"orgId"`
	UID         string       `json:"uid"`
	Version     int64        `json:"version"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

type UpdateRoleCommand struct {
	Id          int64        `json:"id"`
	OrgId       int64        `json:"orgId"`
	Version     int64        `json:"version"`
	UID         string       `json:"uid"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

type DeleteRoleCommand struct {
	Id    int64
	UID   string `json:"uid"`
	OrgId int64
}

type AddTeamRoleCommand struct {
	OrgId  int64
	RoleId int64
	TeamId int64
}

type RemoveTeamRoleCommand struct {
	OrgId  int64
	RoleId int64
	TeamId int64
}

type AddUserRoleCommand struct {
	OrgId  int64
	RoleId int64
	UserId int64
}

type RemoveUserRoleCommand struct {
	OrgId  int64
	RoleId int64
	UserId int64
}

type EvaluationResult struct {
	HasAccess bool
	Meta      interface{}
}

func (p RoleDTO) Role() Role {
	return Role{
		Id:          p.Id,
		OrgId:       p.OrgId,
		Name:        p.Name,
		Description: p.Description,
		Updated:     p.Updated,
		Created:     p.Created,
	}
}
