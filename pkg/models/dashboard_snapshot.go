package models

import "time"

// DashboardSnapshot model
type DashboardSnapshot struct {
	Id   int64
	Name string
	Key  string

	Expires time.Time
	Created time.Time
	Updated time.Time

	Dashboard map[string]interface{}
}

// -----------------
// COMMANDS

type CreateDashboardSnapshotCommand struct {
	Dashboard map[string]interface{} `json:"dashboard" binding:"Required"`
	External  bool

	Key string `json:"-"`

	Result *DashboardSnapshot
}

type GetDashboardSnapshotQuery struct {
	Key string

	Result *DashboardSnapshot
}
