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
	ErrDashboardACLInfoMissing              = errors.New("user id and team id cannot both be empty for a dashboard permission")
	ErrDashboardPermissionDashboardEmpty    = errors.New("dashboard id must be greater than zero for a dashboard permission")
	ErrFolderACLInfoMissing                 = errors.New("user id and team id cannot both be empty for a folder permission")
	ErrFolderPermissionFolderEmpty          = errors.New("folder id must be greater than zero for a folder permission")
	ErrPermissionsWithRoleNotAllowed        = errors.New("permissions cannot have both a user and team")
	ErrPermissionsWithUserAndTeamNotAllowed = errors.New("team and user permissions cannot have an associated role")
)

// Dashboard ACL model
type DashboardACL struct {
	// nolint:stylecheck
	Id          int64
	OrgID       int64 `xorm:"org_id"`
	DashboardID int64 `xorm:"dashboard_id"`

	UserID     int64     `xorm:"user_id"`
	TeamID     int64     `xorm:"team_id"`
	Role       *RoleType // pointer to be nullable
	Permission PermissionType

	Created time.Time
	Updated time.Time
}

type DashboardACLInfoDTO struct {
	OrgId       int64 `json:"-"`
	DashboardId int64 `json:"dashboardId,omitempty"`
	FolderId    int64 `json:"folderId,omitempty"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	UserId         int64          `json:"userId"`
	UserLogin      string         `json:"userLogin"`
	UserEmail      string         `json:"userEmail"`
	UserAvatarUrl  string         `json:"userAvatarUrl"`
	TeamId         int64          `json:"teamId"`
	TeamEmail      string         `json:"teamEmail"`
	TeamAvatarUrl  string         `json:"teamAvatarUrl"`
	Team           string         `json:"team"`
	Role           *RoleType      `json:"role,omitempty"`
	Permission     PermissionType `json:"permission"`
	PermissionName string         `json:"permissionName"`
	Uid            string         `json:"uid"`
	Title          string         `json:"title"`
	Slug           string         `json:"slug"`
	IsFolder       bool           `json:"isFolder"`
	Url            string         `json:"url"`
	Inherited      bool           `json:"inherited"`
}

func (dto *DashboardACLInfoDTO) hasSameRoleAs(other *DashboardACLInfoDTO) bool {
	if dto.Role == nil || other.Role == nil {
		return false
	}

	return dto.UserId <= 0 && dto.TeamId <= 0 && dto.UserId == other.UserId && dto.TeamId == other.TeamId && *dto.Role == *other.Role
}

func (dto *DashboardACLInfoDTO) hasSameUserAs(other *DashboardACLInfoDTO) bool {
	return dto.UserId > 0 && dto.UserId == other.UserId
}

func (dto *DashboardACLInfoDTO) hasSameTeamAs(other *DashboardACLInfoDTO) bool {
	return dto.TeamId > 0 && dto.TeamId == other.TeamId
}

// IsDuplicateOf returns true if other item has same role, same user or same team
func (dto *DashboardACLInfoDTO) IsDuplicateOf(other *DashboardACLInfoDTO) bool {
	return dto.hasSameRoleAs(other) || dto.hasSameUserAs(other) || dto.hasSameTeamAs(other)
}

//
// QUERIES
//
type GetDashboardACLInfoListQuery struct {
	DashboardID int64
	OrgID       int64
	Result      []*DashboardACLInfoDTO
}

func (p DashboardACL) TableName() string { return "dashboard_acl" }
