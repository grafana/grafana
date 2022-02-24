package stars

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	starsstore "github.com/grafana/grafana/pkg/services/stars/store"
)

type Manager interface {
	StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error
	IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error
	GetUserStars(ctx context.Context, cmd *models.GetUserStarsQuery) error
}

type ManagerImpl struct {
	starsStore starsstore.Store
}

func ProvideService(sqlstore sqlstore.Store) Manager {
	return &ManagerImpl{starsStore: starsstore.NewStarsStore(sqlstore)}
}

func (m *ManagerImpl) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	return m.starsStore.StarDashboard(ctx, cmd)
}

func (m *ManagerImpl) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	return m.starsStore.UnstarDashboard(ctx, cmd)
}

func (m *ManagerImpl) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) error {
	return m.starsStore.IsStarredByUserCtx(ctx, query)
}

func (m *ManagerImpl) GetUserStars(ctx context.Context, cmd *models.GetUserStarsQuery) error {
	return m.starsStore.GetUserStars(ctx, cmd)
}
