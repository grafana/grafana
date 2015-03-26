package models

import "time"

// DashboardSnapshot model
type DashboardSnapshot struct {
	Id    int64
	Name  string
	Key   string
	OrgId int64

	Expires time.Time
	Created time.Time
	Updated time.Time

	Dashboard map[string]interface{}
}

// -----------------
// COMMANDS

type CreateDashboardSnapshotCommand struct {
	Dashboard map[string]interface{} `json:"dashboard" binding:"Required"`
	External  bool                   `json:"external"`
	Expires   int64                  `json:"expires"`

	OrgId int64  `json:"-"`
	Key   string `json:"-"`

	Result *DashboardSnapshot
}

type GetDashboardSnapshotQuery struct {
	Key string

	Result *DashboardSnapshot
}
