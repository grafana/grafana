package models

import "time"

type PermissionType int

const (
	PERMISSION_EDIT PermissionType = 1 << iota
	PERMISSION_READ_ONLY_EDIT
	PERMISSION_VIEW
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

	UserId         int64          `json:"userId"`
	UserLogin      string         `json:"userLogin"`
	UserEmail      string         `json:"userEmail"`
	UserGroupId    int64          `json:"userGroupId"`
	UserGroup      string         `json:"userGroup"`
	PermissionType PermissionType `json:"permissionType"`
	Permissions    string         `json:"permissions"`
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
