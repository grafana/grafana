package thumbs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

type CrawlerMode string

const (

	// CrawlerModeThumbs will create small thumbnails for everything.
	CrawlerModeThumbs CrawlerMode = "thumbs"

	// CrawlerModeAnalytics will get full page results for everything.
	CrawlerModeAnalytics CrawlerMode = "analytics"

	// CrawlerModeMigrate will migrate all dashboards with old schema.
	CrawlerModeMigrate CrawlerMode = "migrate"
)

type crawlerState string

const (
	initializing crawlerState = "initializing"
	running      crawlerState = "running"
	stopping     crawlerState = "stopping"
	stopped      crawlerState = "stopped"
)

type previewRequest struct {
	OrgID int64         `json:"orgId"`
	UID   string        `json:"uid"`
	Kind  ThumbnailKind `json:"kind"`
	Theme models.Theme  `json:"theme"`
}

type crawlCmd struct {
	Mode  CrawlerMode  `json:"mode"`  // thumbs | analytics | migrate
	Theme models.Theme `json:"theme"` // light | dark
}

type crawlStatus struct {
	State    crawlerState `json:"state"`
	Started  time.Time    `json:"started,omitempty"`
	Finished time.Time    `json:"finished,omitempty"`
	Complete int          `json:"complete"`
	Errors   int          `json:"errors"`
	Queue    int          `json:"queue"`
	Last     time.Time    `json:"last,omitempty"`
}

type ThumbnailKind string
type ThumbnailState string

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
	Theme            models.Theme   `json:"theme"`
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
	Theme        models.Theme
}

type GetDashboardThumbnailCommand struct {
	DashboardThumbnailMeta
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
}

type FindDashboardsWithStaleThumbnailsCommand struct {
	IncludeManuallyUploadedThumbnails bool
	IncludeThumbnailsWithEmptyDsUIDs  bool
	Theme                             models.Theme
	Kind                              ThumbnailKind
}

type SaveDashboardThumbnailCommand struct {
	DashboardThumbnailMeta
	DashboardVersion int
	Image            []byte
	MimeType         string
	DatasourceUIDs   []string
}

type UpdateThumbnailStateCommand struct {
	State ThumbnailState
	DashboardThumbnailMeta
}

type dashRenderer interface {

	// Run Assumes you have already authenticated as admin.
	Run(ctx context.Context, auth CrawlerAuth, mode CrawlerMode, theme models.Theme, kind ThumbnailKind) error

	// Assumes you have already authenticated as admin.
	Stop() (crawlStatus, error)

	// Assumes you have already authenticated as admin.
	Status() (crawlStatus, error)

	IsRunning() bool
}

type thumbnailRepo interface {
	updateThumbnailState(ctx context.Context, state ThumbnailState, meta DashboardThumbnailMeta) error
	doThumbnailsExist(ctx context.Context) (bool, error)
	saveFromFile(ctx context.Context, filePath string, meta DashboardThumbnailMeta, dashboardVersion int, dsUids []string) (int64, error)
	saveFromBytes(ctx context.Context, bytes []byte, mimeType string, meta DashboardThumbnailMeta, dashboardVersion int, dsUids []string) (int64, error)
	getThumbnail(ctx context.Context, meta DashboardThumbnailMeta) (*DashboardThumbnail, error)
	findDashboardsWithStaleThumbnails(ctx context.Context, theme models.Theme, thumbnailKind ThumbnailKind) ([]*DashboardWithStaleThumbnail, error)
}
