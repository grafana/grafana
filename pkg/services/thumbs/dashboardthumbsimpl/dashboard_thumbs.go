package dashboardthumbsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/thumbs"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) thumbs.DashboardThumbService {
	return &Service{
		store: &xormStore{db: db},
	}
}

func (s *Service) GetThumbnail(ctx context.Context, query *thumbs.GetDashboardThumbnailCommand) (*thumbs.DashboardThumbnail, error) {
	dt, err := s.store.Get(ctx, query)
	return dt, err
}

func (s *Service) SaveThumbnail(ctx context.Context, cmd *thumbs.SaveDashboardThumbnailCommand) (*thumbs.DashboardThumbnail, error) {
	dt, err := s.store.Save(ctx, cmd)
	return dt, err
}

func (s *Service) UpdateThumbnailState(ctx context.Context, cmd *thumbs.UpdateThumbnailStateCommand) error {
	err := s.store.UpdateState(ctx, cmd)
	return err
}

func (s *Service) FindThumbnailCount(ctx context.Context, cmd *thumbs.FindDashboardThumbnailCountCommand) (int64, error) {
	n, err := s.store.Count(ctx, cmd)
	return n, err
}

func (s *Service) FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *thumbs.FindDashboardsWithStaleThumbnailsCommand) ([]*thumbs.DashboardWithStaleThumbnail, error) {
	thumbs, err := s.store.FindDashboardsWithStaleThumbnails(ctx, cmd)
	return thumbs, err
}
