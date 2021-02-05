package rbac

import (
	"fmt"
	"time"
)

var (
	errPolicyNotFound         = fmt.Errorf("policy not found")
	errTeamPolicyAlreadyAdded = fmt.Errorf("policy is already added to this team")
	errUserPolicyAlreadyAdded = fmt.Errorf("policy is already added to this user")
	errTeamPolicyNotFound     = fmt.Errorf("team policy not found")
	errUserPolicyNotFound     = fmt.Errorf("user policy not found")
	errTeamNotFound           = fmt.Errorf("team not found")
	errPermissionNotFound     = fmt.Errorf("permission not found")
)

// Policy is the model for Policy in RBAC.
type Policy struct {
	Id          int64
	OrgId       int64
	Name        string
	Description string

	Updated time.Time
	Created time.Time
}

type PolicyDTO struct {
	Id          int64
	OrgId       int64
	Name        string
	Description string
	Permissions []Permission

	Updated time.Time
	Created time.Time
}

// Policy is the model for Permission in RBAC.
type Permission struct {
	Id         int64
	PolicyId   int64
	Permission string
	Scope      string

	Updated time.Time
	Created time.Time
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

type ListPoliciesQuery struct {
	OrgId int64 `json:"-"`

	Result []*Policy
}

type GetPolicyQuery struct {
	OrgId    int64 `json:"-"`
	PolicyId int64

	Result *PolicyDTO
}

type GetPolicyPermissionsQuery struct {
	PolicyId int64

	Result []Permission
}

type GetTeamPoliciesQuery struct {
	OrgId  int64 `json:"-"`
	TeamId int64

	Result []*PolicyDTO
}

type GetUserPoliciesQuery struct {
	OrgId  int64 `json:"-"`
	UserId int64

	Result []*PolicyDTO
}

type GetUserPermissionsQuery struct {
	OrgId  int64 `json:"-"`
	UserId int64

	Result []Permission
}

type CreatePermissionCommand struct {
	PolicyId   int64
	Permission string
	Scope      string

	Result *Permission
}

type UpdatePermissionCommand struct {
	Id         int64
	Permission string
	Scope      string

	Result *Permission
}

type DeletePermissionCommand struct {
	Id int64
}

type CreatePolicyCommand struct {
	OrgId       int64
	Name        string
	Description string

	Result *Policy
}

type UpdatePolicyCommand struct {
	Id          int64
	Name        string
	Description string

	Result *Policy
}

type DeletePolicyCommand struct {
	Id    int64
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
