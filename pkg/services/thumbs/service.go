package thumbs

import (
	"context"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/org"
)

type Service interface {
	registry.ProvidesUsageStats
	Run(ctx context.Context) error
	Enabled() bool
	GetImage(c *models.ReqContext)
	GetDashboardPreviewsSetupSettings(c *models.ReqContext) DashboardPreviewsSetupConfig

	// from dashboard page
	SetImage(c *models.ReqContext) // form post
	UpdateThumbnailState(c *models.ReqContext)

	// Must be admin
	StartCrawler(c *models.ReqContext) response.Response
	StopCrawler(c *models.ReqContext) response.Response
	CrawlerStatus(c *models.ReqContext) response.Response
}

type CrawlerAuth interface {
	GetUserId(orgId int64) int64
	GetLogin(orgId int64) string
	GetOrgRole() org.RoleType
}

type CrawlerAuthSetupService interface {
	Setup(ctx context.Context) (CrawlerAuth, error)
}

type DashRenderer interface {
	// Run Assumes you have already authenticated as admin.
	Run(ctx context.Context, auth CrawlerAuth, mode CrawlerMode, theme models.Theme, kind ThumbnailKind) error
	// Assumes you have already authenticated as admin.
	Stop() (CrawlStatus, error)
	// Assumes you have already authenticated as admin.
	Status() (CrawlStatus, error)
	IsRunning() bool
}

type ThumbnailRepo interface {
	UpdateThumbnailState(ctx context.Context, state ThumbnailState, meta DashboardThumbnailMeta) error
	DoThumbnailsExist(ctx context.Context) (bool, error)
	SaveFromFile(ctx context.Context, filePath string, meta DashboardThumbnailMeta, dashboardVersion int, dsUids []string) (int64, error)
	SaveFromBytes(ctx context.Context, bytes []byte, mimeType string, meta DashboardThumbnailMeta, dashboardVersion int, dsUids []string) (int64, error)
	GetThumbnail(ctx context.Context, meta DashboardThumbnailMeta) (*DashboardThumbnail, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, theme models.Theme, thumbnailKind ThumbnailKind) ([]*DashboardWithStaleThumbnail, error)
}

type DashboardThumbService interface {
	GetThumbnail(ctx context.Context, query *GetDashboardThumbnailCommand) (*DashboardThumbnail, error)
	SaveThumbnail(ctx context.Context, cmd *SaveDashboardThumbnailCommand) (*DashboardThumbnail, error)
	UpdateThumbnailState(ctx context.Context, cmd *UpdateThumbnailStateCommand) error
	FindThumbnailCount(ctx context.Context, cmd *FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *FindDashboardsWithStaleThumbnailsCommand) ([]*DashboardWithStaleThumbnail, error)
}
