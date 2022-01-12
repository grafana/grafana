package models

import (
	"errors"
	"time"
)

type ThumbnailKind string
type CrawlerMode string

const (
	// ThumbnailKindDefault is a small 320x240 preview
	ThumbnailKindDefault ThumbnailKind = "thumb"

	// unsupported for now
	// - ThumbnailKindLarge ThumbnailKind = "large"
	// - ThumbnailKindTall ThumbnailKind = "tall"
)

// IsKnownThumbnailKind checks if the value is supported
func (p ThumbnailKind) IsKnownThumbnailKind() bool {
	switch p {
	case
		ThumbnailKindDefault:
		return true
	}
	return false
}

func ParseThumbnailKind(str string) (ThumbnailKind, error) {
	switch str {
	case string(ThumbnailKindDefault):
		return ThumbnailKindDefault, nil
	}
	return ThumbnailKindDefault, errors.New("unknown thumbnail kind " + str)
}

// A DashboardThumbnail includes all metadata for a dashboard thumbnail
type DashboardThumbnail struct {
	Id           int64         `json:"id"`
	DashboardId  int64         `json:"dashboardId"`
	PanelId      int64         `json:"panelId,omitempty"`
	Kind         ThumbnailKind `json:"kind"`
	Theme        string        `json:"theme"` // TODO: changing it from `string` to `rendering.Theme` causes gen-go to fail with undescriptive error
	ImageDataUrl string        `json:"imageDataUrl"`
	Updated      time.Time     `json:"updated"`
}

//
// Commands
//

type GetDashboardThumbnailCommand struct {
	DashboardUID string
	PanelID      int64
	Kind         ThumbnailKind
	Theme        string // TODO: same as above

	Result *DashboardThumbnail
}

type SaveDashboardThumbnailCommand struct {
	DashboardID int64
	PanelID     int64
	Kind        ThumbnailKind
	Theme       string // TODO: same as above
	Image       string

	Result *DashboardThumbnail
}
