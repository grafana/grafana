package dashboardthumbs

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	GetThumbnail(ctx context.Context, query *models.GetDashboardThumbnailCommand) (*models.DashboardThumbnail, error)
	SaveThumbnail(ctx context.Context, cmd *models.SaveDashboardThumbnailCommand) (*models.DashboardThumbnail, error)
	UpdateThumbnailState(ctx context.Context, cmd *models.UpdateThumbnailStateCommand) error
	FindThumbnailCount(ctx context.Context, cmd *models.FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *models.FindDashboardsWithStaleThumbnailsCommand) ([]*models.DashboardWithStaleThumbnail, error)
}
