package rbac

import (
	"fmt"
	"time"
)

var (
	// errPolicyNotFound is an error for an unknown alert definition.
	errPolicyNotFound = fmt.Errorf("could not find policy")
)

// Policy is the model for Policy in RBAC.
type Policy struct {
	Id          int64
	OrgId       int64
	Name        string
	Description string
	Permissions []Permission
	Updated     time.Time
	Created     time.Time
}

// Policy is the model for Permission in RBAC.
type Permission struct {
	Id           int64
	OrgId        int64
	PolicyId     int64
	Resource     string
	ResourceType string
	Action       string
	Updated      time.Time
	Created      time.Time
}

type listPoliciesQuery struct {
	OrgId int64 `json:"-"`

	Result []*Policy
}

type getPolicyQuery struct {
	OrgId    int64 `json:"-"`
	PolicyId int64

	Result *Policy
}

type getPolicyPermissionsQuery struct {
	OrgId    int64 `json:"-"`
	PolicyId int64

	Result []Permission
}
