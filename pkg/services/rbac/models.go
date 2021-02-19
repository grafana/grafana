package rbac

import (
	"errors"
	"time"
)

var (
	ErrPolicyNotFound                = errors.New("policy not found")
	ErrTeamPolicyAlreadyAdded        = errors.New("policy is already added to this team")
	ErrUserPolicyAlreadyAdded        = errors.New("policy is already added to this user")
	ErrTeamPolicyNotFound            = errors.New("team policy not found")
	ErrUserPolicyNotFound            = errors.New("user policy not found")
	ErrTeamNotFound                  = errors.New("team not found")
	ErrPermissionNotFound            = errors.New("permission not found")
	ErrPolicyFailedGenerateUniqueUID = errors.New("failed to generate policy definition UID")
)

// Policy is the model for Policy in RBAC.
type Policy struct {
	Id          int64  `json:"id"`
	OrgId       int64  `json:"orgId"`
	UID         string `xorm:"uid" json:"uid"`
	Name        string `json:"name"`
	Description string `json:"description"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type PolicyDTO struct {
	Id          int64        `json:"id"`
	OrgId       int64        `json:"orgId"`
	UID         string       `xorm:"uid" json:"uid"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions,omitempty"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

// Policy is the model for Permission in RBAC.
type Permission struct {
	Id         int64  `json:"id"`
	PolicyId   int64  `json:"-"`
	Permission string `json:"permission"`
	Scope      string `json:"scope"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type TeamPolicy struct {
	Id       int64
	OrgId    int64
	PolicyId int64
	TeamId   int64

	Updated time.Time
	Created time.Time
}

type UserPolicy struct {
	Id       int64
	OrgId    int64
	PolicyId int64
	UserId   int64

	Updated time.Time
	Created time.Time
}

type BuiltinRolePolicy struct {
	ID       *int64 `xorm:"id"`
	PolicyID int64  `xorm:"policy_id"`
	Role     string

	Updated time.Time
	Created time.Time
}

type GetTeamPoliciesQuery struct {
	OrgId  int64 `json:"-"`
	TeamId int64
}

type GetUserPoliciesQuery struct {
	OrgId  int64 `json:"-"`
	UserId int64
}

type GetUserPermissionsQuery struct {
	OrgId  int64 `json:"-"`
	UserId int64
}

type CreatePermissionCommand struct {
	PolicyId   int64
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

type CreatePolicyCommand struct {
	OrgId       int64  `json:"-"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreatePolicyWithPermissionsCommand struct {
	OrgId       int64        `json:"orgId"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

type UpdatePolicyCommand struct {
	Id          int64        `json:"id"`
	OrgId       int64        `json:"orgId"`
	UID         string       `json:"uid"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

type DeletePolicyCommand struct {
	Id    int64
	UID   string `json:"uid"`
	OrgId int64
}

type AddTeamPolicyCommand struct {
	OrgId    int64
	PolicyId int64
	TeamId   int64
}

type RemoveTeamPolicyCommand struct {
	OrgId    int64
	PolicyId int64
	TeamId   int64
}

type AddUserPolicyCommand struct {
	OrgId    int64
	PolicyId int64
	UserId   int64
}

type RemoveUserPolicyCommand struct {
	OrgId    int64
	PolicyId int64
	UserId   int64
}

type EvaluationResult struct {
	HasAccess bool
	Meta      interface{}
}

func (p PolicyDTO) Policy() Policy {
	return Policy{
		Id:          p.Id,
		OrgId:       p.OrgId,
		Name:        p.Name,
		Description: p.Description,
		Updated:     p.Updated,
		Created:     p.Created,
	}
}
