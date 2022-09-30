package dashboardthumbsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/thumbs"
)

type store interface {
	Get(ctx context.Context, query *thumbs.GetDashboardThumbnailCommand) (*thumbs.DashboardThumbnail, error)
	Save(ctx context.Context, cmd *thumbs.SaveDashboardThumbnailCommand) (*thumbs.DashboardThumbnail, error)
	UpdateState(ctx context.Context, cmd *thumbs.UpdateThumbnailStateCommand) error
	Count(ctx context.Context, cmd *thumbs.FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *thumbs.FindDashboardsWithStaleThumbnailsCommand) ([]*thumbs.DashboardWithStaleThumbnail, error)
}
