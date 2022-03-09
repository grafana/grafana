package star

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	starstore "github.com/grafana/grafana/pkg/services/star/store"
)

type Manager interface {
	StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error
	IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error)
	GetUserStars(ctx context.Context, cmd *models.GetUserStarsQuery) (map[int64]bool, error)
}

type managerImpl struct {
	starStore starstore.Store
}

func ProvideService(sqlstore sqlstore.Store) Manager {
	m := &managerImpl{starStore: starstore.NewStarStore(sqlstore)}
	return m
}

func (m *managerImpl) StarDashboard(ctx context.Context, cmd *models.StarDashboardCommand) error {
	return m.starStore.StarDashboard(ctx, cmd)
}

func (m *managerImpl) UnstarDashboard(ctx context.Context, cmd *models.UnstarDashboardCommand) error {
	return m.starStore.UnstarDashboard(ctx, cmd)
}

func (m *managerImpl) IsStarredByUserCtx(ctx context.Context, query *models.IsStarredByUserQuery) (bool, error) {
	return m.starStore.IsStarredByUserCtx(ctx, query)
}

func (m *managerImpl) GetUserStars(ctx context.Context, cmd *models.GetUserStarsQuery) (map[int64]bool, error) {
	return m.starStore.GetUserStars(ctx, cmd)
}
