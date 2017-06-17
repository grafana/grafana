package models

import (
	"errors"
	"time"
)

type PermissionType int

const (
	PERMISSION_VIEW PermissionType = 1 << iota
	PERMISSION_READ_ONLY_EDIT
	PERMISSION_EDIT
)

func (p PermissionType) String() string {
	names := map[int]string{
		int(PERMISSION_VIEW):           "View",
		int(PERMISSION_READ_ONLY_EDIT): "Read-only Edit",
		int(PERMISSION_EDIT):           "Edit",
	}
	return names[int(p)]
}

// Typed errors
var (
	ErrDashboardPermissionUserOrUserGroupEmpty = errors.New("User id and user group id cannot both be empty for a dashboard permission.")
)

// Dashboard ACL model
type DashboardAcl struct {
	Id          int64 `json:"id"`
	OrgId       int64 `json:"-"`
	DashboardId int64 `json:"dashboardId"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	UserId      int64          `json:"userId"`
	UserGroupId int64          `json:"userGroupId"`
	Permissions PermissionType `json:"permissions"`
}

type DashboardAclInfoDTO struct {
	Id          int64 `json:"id"`
	OrgId       int64 `json:"-"`
	DashboardId int64 `json:"dashboardId"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	UserId         int64          `json:"userId"`
	UserLogin      string         `json:"userLogin"`
	UserEmail      string         `json:"userEmail"`
	UserGroupId    int64          `json:"userGroupId"`
	UserGroup      string         `json:"userGroup"`
	Permissions    PermissionType `json:"permissions"`
	PermissionName string         `json:"permissionName"`
}

//
// COMMANDS
//

type AddOrUpdateDashboardPermissionCommand struct {
	DashboardId int64          `json:"-"`
	OrgId       int64          `json:"-"`
	UserId      int64          `json:"userId"`
	UserGroupId int64          `json:"userGroupId"`
	Permissions PermissionType `json:"permissionType" binding:"Required"`

	Result DashboardAcl `json:"-"`
}

type RemoveDashboardPermissionCommand struct {
	DashboardId int64 `json:"dashboardId" binding:"Required"`
	OrgId       int64 `json:"-"`
	UserId      int64 `json:"userId"`
	UserGroupId int64 `json:"userGroupId"`
}

//
// QUERIES
//

type GetDashboardPermissionsQuery struct {
	DashboardId int64 `json:"dashboardId" binding:"Required"`
	Result      []*DashboardAclInfoDTO
}
