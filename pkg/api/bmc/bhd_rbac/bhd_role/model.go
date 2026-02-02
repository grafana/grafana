package bhd_role

import (
	"errors"
	"time"
)

const RoleNotFoundMsg string = "Role not found"
const RoleIdInvalidMsg string = "Role id is invalid"
const RoleNameMissingMsg string = "Role name is missing"
const RoleAlreadyExistMsg string = "Role with the same name already exists"
const RoleCreateSuccessMsg string = "Role created successfully"
const RoleCreateFailureMsg string = "Failed to create role"
const RoleGetFailureMsg string = "Failed to get role"
const RoleUpdateSuccessMsg string = "Role updated successfully"
const RoleUpdateFailureMsg string = "Failed to update role"
const RoleDeleteSuccessMsg string = "Role deleted successfully"
const RoleDeleteFailureMsg string = "Failed to delete role"
const SystemRoleUpdateNotAllowedMsg string = "You cannot update system role."
const SystemRoleDeleteNotAllowedMsg string = "You cannot delete system role."
const RoleDeleteUserAssociationMsg string = "This role is associated with users. Before deleting the role, delete all the associations."
const RoleDeleteTeamAssociationMsg string = "This role is associated with teams. Before deleting the role, delete all the associations."

var (
	ErrRoleNotFound                       = errors.New("not-found")
	ErrRoleNameMissing                    = errors.New("name-missing")
	ErrRoleAlreadyExist                   = errors.New("name-already-exists")
	ErrSystemRoleUpdateNotAllowed         = errors.New("system-role-update-not-allowed")
	ErrSystemRoleDeleteNotAllowed         = errors.New("system-role-delete-not-allowed")
	ErrUserAssociatedRoleDeleteNotAllowed = errors.New("user-associated-role-delete-not-allowed")
	ErrTeamAssociatedRoleDeleteNotAllowed = errors.New("team-associated-role-delete-not-allowed")
)

type SearchBHDRolesQuery struct {
	Query   string
	Name    string
	OrderBy string
	Limit   int
	Page    int
	OrgID   int64 `xorm:"org_id"`
}

type BHDRoleDTO struct {
	ID          int64   `json:"id" xorm:"bhd_role_id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	OrgID       int64   `json:"orgId" xorm:"org_id"`
	SystemRole  bool    `json:"systemRole" xorm:"system_role"`
	Users       []int64 `json:"users,omitempty" xorm:"users"`
	Teams       []int64 `json:"teams,omitempty" xorm:"teams"`
}

type BHDRoleDTORequest struct {
	ID          int64     `xorm:"pk autoincr 'bhd_role_id'"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OrgID       int64     `json:"orgId" xorm:"org_id"`
	SystemRole  bool      `json:"systemRole" xorm:"system_role"`
	CreatedTime time.Time `json:"createdTime" xorm:"created_time"`
	UpdatedTime time.Time `json:"updatedTime" xorm:updated_time"`
	CreatedBy   string    `json:"createdBy" xorm:"created_by"`
	UpdatedBy   string    `json:"updatedBy" xorm:updated_by"`
}

type CreateBHDRoleResponse struct {
	Message string `json:"message"`
	RoleId  int    `json:"bhdRoleId,omitempty"`
}

type SearchBHDRolesQueryResult struct {
	TotalCount int64         `json:"totalCount"`
	BHDRoles   []*BHDRoleDTO `json:"roles"`
	Page       int           `json:"page"`
	PerPage    int           `json:"perPage"`
}

type GetBHDRoleByIDQuery struct {
	OrgID              int64
	ID                 int64
	IncludeAssociation bool
}

type UpdateUsersBHDRoleQuery struct {
	OrgID        int64
	ID           int64
	UsersAdded   []int64 `json:"usersAdded"`
	UsersRemoved []int64 `json:"usersRemoved"`
}

type UserBHDRoleMapping struct {
	OrgID     int64 `xorm:"org_id"`
	UserID    int64 `json:"userId" xorm:"user_id"`
	BHDRoleID int64 `json:"bhdRoleId" xorm:"bhd_role_id"`
}

type UpdateUsersBHDRoleQueryResult struct {
	Message string `json:"message"`
}

type UpdateTeamsBHDRoleQuery struct {
	OrgID        int64
	ID           int64
	TeamsAdded   []int64 `json:"teamsAdded"`
	TeamsRemoved []int64 `json:"teamsRemoved"`
}

type TeamBHDRoleMapping struct {
	OrgID     int64 `xorm:"org_id"`
	TeamID    int64 `json:"teamId" xorm:"team_id"`
	BHDRoleID int64 `json:"bhdRoleId" xorm:"bhd_role_id"`
}

type UpdateTeamsBHDRoleQueryResult struct {
	Message string `json:"message"`
}

type UserRoleListResult struct {
	RoleIds []int64 `json:"roleIdList"`
}

type MessageResponse struct {
	Message string `json:"message"`
}
