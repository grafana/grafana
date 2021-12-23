package models

import (
	"errors"
	"time"
)

var (
	ErrDashboardThumbnailNotFound = errors.New("dashboard thumbnail not found")
)

// A DashboardThumbnail includes all metadata for a dashbaord thumbnail
type DashboardThumbnail struct {
	Id           int64     `json:"id"`
	DashboardUID string    `json:"dashboard"`
	PanelId      int64     `json:"panelId,omitempty"`
	Kind         string    `json:"kind"`
	Theme        string    `json:"theme"`
	Image        string    `json:"image"`
	Updated      time.Time `json:"updated"`
}

//
// Commands
//

type GetDashboardThumbnailCommand struct {
	DashboardUID string
	PanelID      int64

	Result *DashboardThumbnail
}

type SaveDashboardThumbnailCommand struct {
	DashboardUID string
	PanelID      int64
	Kind         string
	Theme        string
	Image        string

	Result *DashboardThumbnail
}
