package models

import "time"

type AppSettings struct {
	Id       int64
	AppId    string
	OrgId    int64
	Enabled  bool
	Pinned   bool
	JsonData map[string]interface{}

	Created time.Time
	Updated time.Time
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type UpdateAppSettingsCmd struct {
	Enabled  bool                   `json:"enabled"`
	Pinned   bool                   `json:"pinned"`
	JsonData map[string]interface{} `json:"jsonData"`

	AppId string `json:"-"`
	OrgId int64  `json:"-"`
}

// ---------------------
// QUERIES
type GetAppSettingsQuery struct {
	OrgId  int64
	Result []*AppSettings
}
