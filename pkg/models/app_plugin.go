package models

import "time"

type AppPlugin struct {
	Id          int64
	Type        string
	OrgId       int64
	Enabled     bool
	PinNavLinks bool
	JsonData    map[string]interface{}

	Created time.Time
	Updated time.Time
}

// ----------------------
// COMMANDS

// Also acts as api DTO
type UpdateAppPluginCmd struct {
	Type        string                 `json:"type" binding:"Required"`
	Enabled     bool                   `json:"enabled"`
	PinNavLinks bool                   `json:"pin_nav_links"`
	JsonData    map[string]interface{} `json:"jsonData"`

	Id    int64 `json:"-"`
	OrgId int64 `json:"-"`
}

// ---------------------
// QUERIES
type GetAppPluginsQuery struct {
	OrgId  int64
	Result []*AppPlugin
}
