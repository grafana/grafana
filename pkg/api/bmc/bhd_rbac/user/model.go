package user

import "errors"

// Typed errors
var (
	ErrCaseInsensitive   = errors.New("case insensitive conflict")
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrLastGrafanaAdmin  = errors.New("cannot remove last grafana admin")
	ErrProtectedUser     = errors.New("cannot adopt protected user")
	ErrNoUniqueID        = errors.New("identifying id not found")
)

type SearchUsersQuery struct {
	Query     string
	Name      string
	BHDRoleID int64
	Selected  bool
	OrderBy   string
	Limit     int
	Page      int
	OrgID     int64 `xorm:"org_id"`
}

type SearchUserQueryResult struct {
	TotalCount    int64     `json:"totalCount"`
	SelectedCount int64     `json:"selectedCount"`
	Users         []UserDTO `json:"users"`
	Page          int       `json:"page"`
	PerPage       int       `json:"perPage"`
}

type UserDTO struct {
	ID         int64   `json:"id" xorm:"id"`
	Name       string  `json:"name"`
	Login      string  `json:"login"`
	Email      string  `json:"email"`
	BHDRoleIDs []int64 `json:"bhdRoleIds" xorm:"bhd_role_ids"`
}
type CountQueryResult struct {
	Result []CntResult
}

type CntResult struct {
	TotalCount    int64 `xorm:"totalCount"`
	SelectedCount int64 `xorm:"selectedCount"`
}

type BhdUserRole struct {
	UserId    int64 `xorm:"user_id"`
	BhdRoleId int64 `xorm:"bhd_role_id"`
	OrgId     int64 `xorm:"org_id"`
}

type UserRoleMappingCommand struct {
	ID     int64
	RoleId int64
	OrgID  int64
}

type UserAuthCommand struct {
	UserID      int64    `json:"userId"`
	OrgID       int64    `json:"orgId"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

type UserAuthResponse struct {
	Status  int64  `json:"statusCode"`
	Message string `json:"statusMessage"`
	BHDCode string `json:"bhdCode"`
}
