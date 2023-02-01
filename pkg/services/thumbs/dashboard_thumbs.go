package thumbs

import (
	"context"

	thumbsmodel "github.com/grafana/grafana/pkg/services/thumbs/model"
)

type DashboardThumbService interface {
	GetThumbnail(ctx context.Context, query *thumbsmodel.GetDashboardThumbnailCommand) (*thumbsmodel.DashboardThumbnail, error)
	SaveThumbnail(ctx context.Context, cmd *thumbsmodel.SaveDashboardThumbnailCommand) (*thumbsmodel.DashboardThumbnail, error)
	UpdateThumbnailState(ctx context.Context, cmd *thumbsmodel.UpdateThumbnailStateCommand) error
	FindThumbnailCount(ctx context.Context, cmd *thumbsmodel.FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *thumbsmodel.FindDashboardsWithStaleThumbnailsCommand) ([]*thumbsmodel.DashboardWithStaleThumbnail, error)
}
