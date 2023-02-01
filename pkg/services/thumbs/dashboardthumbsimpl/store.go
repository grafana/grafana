package dashboardthumbsimpl

import (
	"context"

	thumbsmodel "github.com/grafana/grafana/pkg/services/thumbs/model"
)

type store interface {
	Get(ctx context.Context, query *thumbsmodel.GetDashboardThumbnailCommand) (*thumbsmodel.DashboardThumbnail, error)
	Save(ctx context.Context, cmd *thumbsmodel.SaveDashboardThumbnailCommand) (*thumbsmodel.DashboardThumbnail, error)
	UpdateState(ctx context.Context, cmd *thumbsmodel.UpdateThumbnailStateCommand) error
	Count(ctx context.Context, cmd *thumbsmodel.FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *thumbsmodel.FindDashboardsWithStaleThumbnailsCommand) ([]*thumbsmodel.DashboardWithStaleThumbnail, error)
}
