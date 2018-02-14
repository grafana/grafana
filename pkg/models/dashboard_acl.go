package models

import (
	"errors"
	"time"
)

type PermissionType int

const (
	PERMISSION_VIEW PermissionType = 1 << iota
	PERMISSION_EDIT
	PERMISSION_ADMIN
)

func (p PermissionType) String() string {
	names := map[int]string{
		int(PERMISSION_VIEW):  "View",
		int(PERMISSION_EDIT):  "Edit",
		int(PERMISSION_ADMIN): "Admin",
	}
	return names[int(p)]
}

// Typed errors
var (
	ErrDashboardAclInfoMissing           = errors.New("User id and team id cannot both be empty for a dashboard permission.")
	ErrDashboardPermissionDashboardEmpty = errors.New("Dashboard Id must be greater than zero for a dashboard permission.")
)

// Dashboard ACL model
type DashboardAcl struct {
	Id          int64
	OrgId       int64
	DashboardId int64

	UserId     int64
	TeamId     int64
	Role       *RoleType // pointer to be nullable
	Permission PermissionType

	Created time.Time
	Updated time.Time
}

type DashboardAclInfoDTO struct {
	OrgId       int64 `json:"-"`
	DashboardId int64 `json:"dashboardId"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	UserId         int64          `json:"userId"`
	UserLogin      string         `json:"userLogin"`
	UserEmail      string         `json:"userEmail"`
	TeamId         int64          `json:"teamId"`
	Team           string         `json:"team"`
	Role           *RoleType      `json:"role,omitempty"`
	Permission     PermissionType `json:"permission"`
	PermissionName string         `json:"permissionName"`
	Uid            string         `json:"uid"`
	Title          string         `json:"title"`
	Slug           string         `json:"slug"`
	IsFolder       bool           `json:"isFolder"`
	Url            string         `json:"url"`
}

//
// COMMANDS
//

type UpdateDashboardAclCommand struct {
	DashboardId int64
	Items       []*DashboardAcl
}

//
// QUERIES
//
type GetDashboardAclInfoListQuery struct {
	DashboardId int64
	OrgId       int64
	Result      []*DashboardAclInfoDTO
}
