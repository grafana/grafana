package models

import "time"

type VisitDashboardCommand struct {
	UserId      int64
	DashboardId int64
	OrgId       int64
}

// VisitDashboardCommand is the command to add an entry in the DB that
// the user `UserId` visited the dashboard `DashboardId` in `OrgId`
type DashboardVisit struct {
	UserId      int64
	DashboardId int64
	OrgId       int64
	VisitedAt   time.Time
}
