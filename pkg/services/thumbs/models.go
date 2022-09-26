package thumbs

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	dashboardthumbs "github.com/grafana/grafana/pkg/services/dashboard_thumbs"
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
	OrgID int64                         `json:"orgId"`
	UID   string                        `json:"uid"`
	Kind  dashboardthumbs.ThumbnailKind `json:"kind"`
	Theme models.Theme                  `json:"theme"`
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

type dashboardPreviewsSystemRequirements struct {
	Met                                bool   `json:"met"`
	RequiredImageRendererPluginVersion string `json:"requiredImageRendererPluginVersion"`
}

type dashboardPreviewsSetupConfig struct {
	SystemRequirements dashboardPreviewsSystemRequirements `json:"systemRequirements"`
	ThumbnailsExist    bool                                `json:"thumbnailsExist"`
}

type dashRenderer interface {

	// Run Assumes you have already authenticated as admin.
	Run(ctx context.Context, auth CrawlerAuth, mode CrawlerMode, theme models.Theme, kind dashboardthumbs.ThumbnailKind) error

	// Assumes you have already authenticated as admin.
	Stop() (crawlStatus, error)

	// Assumes you have already authenticated as admin.
	Status() (crawlStatus, error)

	IsRunning() bool
}

type thumbnailRepo interface {
	updateThumbnailState(ctx context.Context, state dashboardthumbs.ThumbnailState, meta dashboardthumbs.DashboardThumbnailMeta) error
	doThumbnailsExist(ctx context.Context) (bool, error)
	saveFromFile(ctx context.Context, filePath string, meta dashboardthumbs.DashboardThumbnailMeta, dashboardVersion int, dsUids []string) (int64, error)
	saveFromBytes(ctx context.Context, bytes []byte, mimeType string, meta dashboardthumbs.DashboardThumbnailMeta, dashboardVersion int, dsUids []string) (int64, error)
	getThumbnail(ctx context.Context, meta dashboardthumbs.DashboardThumbnailMeta) (*dashboardthumbs.DashboardThumbnail, error)
	findDashboardsWithStaleThumbnails(ctx context.Context, theme models.Theme, thumbnailKind dashboardthumbs.ThumbnailKind) ([]*dashboardthumbs.DashboardWithStaleThumbnail, error)
}
