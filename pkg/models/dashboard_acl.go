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

	UserId      int64          `json:"userId"`
	UserLogin   string         `json:"userLogin"`
	UserEmail   string         `json:"userEmail"`
	UserGroupId int64          `json:"userGroupId"`
	UserGroup   string         `json:"userGroup"`
	Permissions PermissionType `json:"permissions"`
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
	Result      []*DashboardAclInfoDTO
}
