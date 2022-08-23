package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type ThumbnailKind string
type ThumbnailState string
type CrawlerMode string

const (
	// ThumbnailKindDefault is a small 320x240 preview
	ThumbnailKindDefault ThumbnailKind = "thumb"

	// unsupported for now
	// - ThumbnailKindLarge ThumbnailKind = "large"
	// - ThumbnailKindTall ThumbnailKind = "tall"
)

const (
	// ThumbnailStateDefault is the initial state for all thumbnails. Thumbnails in the "default" state will be considered stale,
	// and thus refreshed by the crawler, if the dashboard version from the time of taking the thumbnail is different from the current dashboard version
	ThumbnailStateDefault ThumbnailState = "default"

	// ThumbnailStateStale is a manually assigned state. Thumbnails in the "stale" state will be refreshed on the next crawler run
	ThumbnailStateStale ThumbnailState = "stale"

	// ThumbnailStateLocked is a manually assigned state. Thumbnails in the "locked" state will not be refreshed by the crawler as long as they remain in the "locked" state.
	ThumbnailStateLocked ThumbnailState = "locked"
)

func (s ThumbnailState) IsValid() bool {
	return s == ThumbnailStateDefault || s == ThumbnailStateStale || s == ThumbnailStateLocked
}

func (s *ThumbnailState) UnmarshalJSON(data []byte) error {
	var str string
	err := json.Unmarshal(data, &str)
	if err != nil {
		return err
	}

	*s = ThumbnailState(str)

	if !s.IsValid() {
		if (*s) != "" {
			return fmt.Errorf("JSON validation error: invalid thumbnail state value: %s", *s)
		}

		*s = ThumbnailStateDefault
	}

	return nil
}

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
	Id               int64          `json:"id"`
	DashboardId      int64          `json:"dashboardId"`
	DashboardVersion int            `json:"dashboardVersion"`
	State            ThumbnailState `json:"state"`
	PanelId          int64          `json:"panelId,omitempty"`
	Kind             ThumbnailKind  `json:"kind"`
	Theme            Theme          `json:"theme"`
	Image            []byte         `json:"image"`
	MimeType         string         `json:"mimeType"`
	Updated          time.Time      `json:"updated"`
	DsUIDs           string         `json:"-" xorm:"ds_uids"`
}

//
// Commands
//

// DashboardThumbnailMeta uniquely identifies a thumbnail; a natural key
type DashboardThumbnailMeta struct {
	DashboardUID string
	OrgId        int64
	PanelID      int64
	Kind         ThumbnailKind
	Theme        Theme
}

type GetDashboardThumbnailCommand struct {
	DashboardThumbnailMeta

	Result *DashboardThumbnail
}

const DashboardVersionForManualThumbnailUpload = -1

type DashboardWithStaleThumbnail struct {
	Id      int64
	OrgId   int64
	Uid     string
	Version int
	Slug    string
}

type FindDashboardThumbnailCountCommand struct {
	Result int64
}

type FindDashboardsWithStaleThumbnailsCommand struct {
	IncludeManuallyUploadedThumbnails bool
	IncludeThumbnailsWithEmptyDsUIDs  bool
	Theme                             Theme
	Kind                              ThumbnailKind
	Result                            []*DashboardWithStaleThumbnail
}

type SaveDashboardThumbnailCommand struct {
	DashboardThumbnailMeta
	DashboardVersion int
	Image            []byte
	MimeType         string
	DatasourceUIDs   []string

	Result *DashboardThumbnail
}

type UpdateThumbnailStateCommand struct {
	State ThumbnailState
	DashboardThumbnailMeta
}
