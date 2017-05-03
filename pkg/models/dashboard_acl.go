package models

import "time"

type PermissionType int

const (
	PERMISSION_EDIT           PermissionType = 4
	PERMISSION_READ_ONLY_EDIT PermissionType = 2
	PERMISSION_VIEW           PermissionType = 1
)

// Typed errors
// var (
// 	ErrDashboardPermissionAlreadyAdded = errors.New("A permission has  ")
// )

// Dashboard ACL model
type DashboardAcl struct {
	Id          int64
	OrgId       int64
	DashboardId int64

	Created time.Time
	Updated time.Time

	UserId      int64
	UserGroupId int64
	Permissions PermissionType
}

//
// COMMANDS
//

type AddOrUpdateDashboardPermissionCommand struct {
	DashboardId    int64          `json:"dashboardId" binding:"Required"`
	OrgId          int64          `json:"-"`
	UserId         int64          `json:"userId"`
	UserGroupId    int64          `json:"userGroupId"`
	PermissionType PermissionType `json:"permissionType" binding:"Required"`
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
	Result      []*DashboardAcl
}
