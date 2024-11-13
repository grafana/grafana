package star

import "errors"

var ErrCommandValidationFailed = errors.New("command missing required fields")

type Star struct {
	ID           int64  `xorm:"pk autoincr 'id'" db:"id"`
	UserID       int64  `xorm:"user_id" db:"user_id"`
	DashboardID  int64  `xorm:"dashboard_id" db:"dashboard_id"`
	DashboardUID string `xorm:"dashboard_id" db:"dashboard_uid"`
	OrgID        int64  `xorm:"org_id" db:"org_id"`
}

// ----------------------
// COMMANDS

type StarDashboardCommand struct {
	UserID       int64  `xorm:"user_id"`
	DashboardID  int64  `xorm:"dashboard_id"`
	DashboardUID string `xorm:"dashboard_uid"`
	OrgID        int64  `xorm:"org_id" db:"org_id"`
}

func (cmd *StarDashboardCommand) Validate() error {
	if cmd.DashboardID == 0 || cmd.UserID == 0 {
		return ErrCommandValidationFailed
	}
	return nil
}

type UnstarDashboardCommand struct {
	UserID       int64  `xorm:"user_id"`
	DashboardID  int64  `xorm:"dashboard_id"`
	DashboardUID string `xorm:"dashboard_uid"`
	OrgID        int64  `xorm:"org_id" db:"org_id"`
}

func (cmd *UnstarDashboardCommand) Validate() error {
	if (cmd.DashboardID == 0 && cmd.DashboardUID == "" && cmd.OrgID == 0) || cmd.UserID == 0 {
		return ErrCommandValidationFailed
	}
	return nil
}

// ---------------------
// QUERIES

type GetUserStarsQuery struct {
	UserID int64 `xorm:"user_id"`
}

type IsStarredByUserQuery struct {
	UserID       int64  `xorm:"user_id"`
	DashboardID  int64  `xorm:"dashboard_id"`
	DashboardUID string `xorm:"dashboard_uid"`
	OrgID        int64  `xorm:"org_id" db:"org_id"`
}

type GetUserStarsResult struct {
	UserStars map[string]bool
}
