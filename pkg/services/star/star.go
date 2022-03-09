package star

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Manager interface {
	StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error
	IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error)
	GetUserStars(ctx context.Context, cmd *models.GetUserStarsQuery) (map[int64]bool, error)
}

type managerImpl struct {
	starStore store
}

func ProvideService(sqlstore sqlstore.Store) Manager {
	m := &managerImpl{starStore: newStarStore(sqlstore)}
	return m
}

func (m *managerImpl) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return models.ErrCommandValidationFailed
	}
	return m.starStore.insert(ctx, cmd)
}

func (m *managerImpl) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return models.ErrCommandValidationFailed
	}
	return m.starStore.delete(ctx, cmd)
}

func (m *managerImpl) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error) {
	return m.starStore.isStarredByUserCtx(ctx, query)
}

func (m *managerImpl) GetUserStars(ctx context.Context, cmd *models.GetUserStarsQuery) (map[int64]bool, error) {
	return m.starStore.getUserStars(ctx, cmd)
}
