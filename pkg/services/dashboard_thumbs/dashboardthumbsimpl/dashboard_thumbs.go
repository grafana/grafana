package dashboardthumbsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
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

func (s *Service) GetThumbnail(ctx context.Context, query *models.GetDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	dt, err := s.store.Get(ctx, query)
	if err != nil {
		return dt, err
	}
	return dt, nil
}

func (s *Service) SaveThumbnail(ctx context.Context, cmd *models.SaveDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	dt, err := s.store.Save(ctx, cmd)
	if err != nil {
		return dt, err
	}
	return dt, nil
}

func (s *Service) UpdateThumbnailState(ctx context.Context, cmd *models.UpdateThumbnailStateCommand) error {
	err := s.store.UpdateState(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) FindThumbnailCount(ctx context.Context, cmd *models.FindDashboardThumbnailCountCommand) (int64, error) {
	i, err := s.store.Count(ctx, cmd)
	if err != nil {
		return i, err
	}
	return 0, nil
}

func (s *Service) FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *models.FindDashboardsWithStaleThumbnailsCommand) ([]*models.DashboardWithStaleThumbnail, error) {
	d, err := s.store.FindDashboardsWithStaleThumbnails(ctx, cmd)
	if err != nil {
		return d, err
	}
	return nil, nil
}
