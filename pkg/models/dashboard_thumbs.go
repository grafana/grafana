package models

import (
	"time"
)

// A DashboardThumbnail includes all metadata for a dashbaord thumbnail
type DashboardThumbnail struct {
	Id           int64     `json:"id"`
	DashboardId  int64     `json:"dashboardId"`
	PanelId      int64     `json:"panelId,omitempty"`
	Kind         string    `json:"kind"`
	Theme        string    `json:"theme"`
	ImageDataUrl string    `json:"imageDataUrl"`
	Updated      time.Time `json:"updated"`
}

//
// Commands
//

type GetDashboardThumbnailCommand struct {
	DashboardUID string
	PanelID      int64
	Kind         string
	Theme        string

	Result *DashboardThumbnail
}

type SaveDashboardThumbnailCommand struct {
	DashboardID int64
	PanelID     int64
	Kind        string
	Theme       string
	Image       string

	Result *DashboardThumbnail
}
