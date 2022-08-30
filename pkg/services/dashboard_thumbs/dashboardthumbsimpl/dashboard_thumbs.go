package dashboardthumbsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
)

type Service struct {
	// TODO remove sqlstore
	sqlStore *sqlstore.SQLStore
}

func ProvideService(
	ss *sqlstore.SQLStore,
) tempuser.Service {
	return &Service{
		sqlStore: ss,
	}
}

func (s *Service) GetThumbnail(ctx context.Context, query *models.GetDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	_, err := s.sqlStore.GetThumbnail(ctx, query)
	if err != nil {
		return err
	}
	return query, nil
}

func (s *Service) SaveThumbnail(ctx context.Context, cmd *models.SaveDashboardThumbnailCommand) (*models.DashboardThumbnail, error) {
	err := s.sqlStore.SaveThumbnail(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) UpdateThumbnailState(ctx context.Context, cmd *models.UpdateThumbnailStateCommand) error {
	err := s.sqlStore.UpdateThumbnailState(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) FindThumbnailCount(ctx context.Context, cmd *models.FindDashboardThumbnailCountCommand) (int64, error) {
	err := s.sqlStore.FindThumbnailCount(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) FindDashboardsWithStaleThumbnails(ctx context.Context, cmd *models.FindDashboardsWithStaleThumbnailsCommand) ([]*models.DashboardWithStaleThumbnail, error) {
	err := s.sqlStore.GetTempUserByCode(ctx, cmd)
	if err != nil {
		return err
	}
	return nil
}
