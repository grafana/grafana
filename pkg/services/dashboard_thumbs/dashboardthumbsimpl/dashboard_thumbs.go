package dashboardthumbsimpl

import (
	"context"

	dashboardthumbs "github.com/grafana/grafana/pkg/services/dashboard_thumbs"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

type Service struct {
	store store
}

func ProvideService(
	db db.DB,
) dashboardthumbs.Service {
	return &Service{
		store: &xormStore{db: db},
	}
}

func (s *Service) GetThumbnail(ctx context.Context, query *dashboardthumbs.GetDashboardThumbnailCommand) (*dashboardthumbs.DashboardThumbnail, error) {
	dt, err := s.store.Get(ctx, query)
	return dt, err
}

func (s *Service) SaveThumbnail(ctx context.Context, cmd *dashboardthumbs.SaveDashboardThumbnailCommand) (*dashboardthumbs.DashboardThumbnail, error) {
	dt, err := s.store.Save(ctx, cmd)
	return dt, err
}

func (s *Service) UpdateThumbnailState(ctx context.Context, cmd *dashboardthumbs.UpdateThumbnailStateCommand) error {
	err := s.store.UpdateState(ctx, cmd)
	return err
}

func (s *Service) FindThumbnailCount(ctx context.Context, cmd *dashboardthumbs.FindDashboardThumbnailCountCommand) (int64, error) {
	n, err := s.store.Count(ctx, cmd)
	return n, err
}

func (s *Service) FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *dashboardthumbs.FindDashboardsWithStaleThumbnailsCommand) ([]*dashboardthumbs.DashboardWithStaleThumbnail, error) {
	thumbs, err := s.store.FindDashboardsWithStaleThumbnails(ctx, cmd)
	return thumbs, err
}
