package team

import "errors"

var (
	ErrTeamNotFound = errors.New("team not found")
)

type SearchTeamQuery struct {
	Query     string
	Name      string
	Email     string
	BHDRoleID int64
	Selected  bool
	Id        int
	Page      int
	OrderBy   string
	Limit     int
	OrgID     int64 `xorm:"org_id"`
}

type SearchTeamQueryResult struct {
	TotalCount    int64     `json:"totalCount"`
	SelectedCount int64     `json:"selectedCount"`
	Teams         []TeamDTO `json:"teams"`
	Page          int       `json:"page"`
	PerPage       int       `json:"perPage"`
}

type TeamDTO struct {
	ID         int64   `json:"id" xorm:"id"`
	Name       string  `json:"name"`
	Email      string  `json:"email"`
	BHDRoleIDs []int64 `json:"bhdRoleIds" xorm:"bhd_role_ids"`
	IsMspTeam  bool    `json:"isMspTeam" xorm:"is_msp_team"`
}

type CntResult struct {
	TotalCount    int64 `xorm:"totalCount"`
	SelectedCount int64 `xorm:"selectedCount"`
}

type AddTeamRoleCommand struct {
	ID     int64
	RoleId int64
	OrgID  int64
}

type BhdTeamRole struct {
	TeamId    int64 `xorm:"team_id"`
	BhdRoleId int64 `xorm:"bhd_role_id"`
	OrgId     int64 `xorm:"org_id"`
}
