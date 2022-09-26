package dashboardthumbsimpl

import (
	"context"

	dashboardthumbs "github.com/grafana/grafana/pkg/services/dashboard_thumbs"
)

type store interface {
	Get(ctx context.Context, query *dashboardthumbs.GetDashboardThumbnailCommand) (*dashboardthumbs.DashboardThumbnail, error)
	Save(ctx context.Context, cmd *dashboardthumbs.SaveDashboardThumbnailCommand) (*dashboardthumbs.DashboardThumbnail, error)
	UpdateState(ctx context.Context, cmd *dashboardthumbs.UpdateThumbnailStateCommand) error
	Count(ctx context.Context, cmd *dashboardthumbs.FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *dashboardthumbs.FindDashboardsWithStaleThumbnailsCommand) ([]*dashboardthumbs.DashboardWithStaleThumbnail, error)
}
