package star

import (
	"errors"
	"time"
)

var ErrCommandValidationFailed = errors.New("command missing required fields")

type Star struct {
	ID     int64 `xorm:"pk autoincr 'id'" db:"id"`
	UserID int64 `xorm:"user_id" db:"user_id"`
	// Deprecated: use DashboardUID (since 12.2 this value may not match the dashboards table)
	DashboardID  int64     `xorm:"dashboard_id" db:"dashboard_id"`
	DashboardUID string    `xorm:"dashboard_uid" db:"dashboard_uid"`
	OrgID        int64     `xorm:"org_id" db:"org_id"`
	Updated      time.Time `xorm:"updated" db:"updated"`
}

// ----------------------
// COMMANDS

type StarDashboardCommand struct {
	UserID       int64     `xorm:"user_id"`
	DashboardUID string    `xorm:"dashboard_uid"`
	OrgID        int64     `xorm:"org_id"`
	Updated      time.Time `xorm:"updated"`
}

func (cmd *StarDashboardCommand) Validate() error {
	if (cmd.DashboardUID == "" && cmd.OrgID == 0) || cmd.UserID == 0 {
		return ErrCommandValidationFailed
	}
	return nil
}

type UnstarDashboardCommand struct {
	UserID       int64  `xorm:"user_id"`
	DashboardUID string `xorm:"dashboard_uid"`
	OrgID        int64  `xorm:"org_id"`
}

func (cmd *UnstarDashboardCommand) Validate() error {
	// nolint:staticcheck
	if (cmd.DashboardUID == "" && cmd.OrgID == 0) || cmd.UserID == 0 {
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
	UserID       int64     `xorm:"user_id"`
	DashboardUID string    `xorm:"dashboard_uid"`
	OrgID        int64     `xorm:"org_id"`
	Updated      time.Time `xorm:"updated"`
}

type GetUserStarsResult struct {
	UserStars map[string]bool
}
