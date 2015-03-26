package models

import "time"

// DashboardSnapshot model
type DashboardSnapshot struct {
	Id          int64
	Name        string
	Key         string
	DeleteKey   string
	OrgId       int64
	UserId      int64
	External    bool
	ExternalUrl string

	Expires time.Time
	Created time.Time
	Updated time.Time

	Dashboard map[string]interface{}
}

// -----------------
// COMMANDS

type CreateDashboardSnapshotCommand struct {
	Dashboard   map[string]interface{} `json:"dashboard" binding:"Required"`
	External    bool                   `json:"external"`
	ExternalUrl string                 `json:"externalUrl"`
	Expires     int64                  `json:"expires"`

	OrgId     int64  `json:"-"`
	UserId    int64  `json:"-"`
	Key       string `json:"-"`
	DeleteKey string `json:"-"`

	Result *DashboardSnapshot
}

type DeleteDashboardSnapshotCommand struct {
	DeleteKey string `json:"-"`
}

type GetDashboardSnapshotQuery struct {
	Key string

	Result *DashboardSnapshot
}
