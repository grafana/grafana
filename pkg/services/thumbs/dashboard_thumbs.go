package thumbs

import (
	"context"
)

type DashboardThumbService interface {
	GetThumbnail(ctx context.Context, query *GetDashboardThumbnailCommand) (*DashboardThumbnail, error)
	SaveThumbnail(ctx context.Context, cmd *SaveDashboardThumbnailCommand) (*DashboardThumbnail, error)
	UpdateThumbnailState(ctx context.Context, cmd *UpdateThumbnailStateCommand) error
	FindThumbnailCount(ctx context.Context, cmd *FindDashboardThumbnailCountCommand) (int64, error)
	FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *FindDashboardsWithStaleThumbnailsCommand) ([]*DashboardWithStaleThumbnail, error)
}
