package star

import (
	"context"

	starmodel "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Manager interface {
	StarDashboard(ctx context.Context, cmd *starmodel.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *starmodel.UnstarDashboardCommand) error
	IsStarredByUserCtx(ctx context.Context, query *starmodel.IsStarredByUserQuery) (bool, error)
	GetUserStars(ctx context.Context, cmd *starmodel.GetUserStarsQuery) (map[int64]bool, error)
}

type managerImpl struct {
	starStore store
}

func ProvideService(sqlstore sqlstore.Store) Manager {
	m := &managerImpl{starStore: newStarStore(sqlstore)}
	return m
}

func (m *managerImpl) StarDashboard(ctx context.Context, cmd *starmodel.StarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return starmodel.ErrCommandValidationFailed
	}
	return m.starStore.insert(ctx, cmd)
}

func (m *managerImpl) UnstarDashboard(ctx context.Context, cmd *starmodel.UnstarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return starmodel.ErrCommandValidationFailed
	}
	return m.starStore.delete(ctx, cmd)
}

func (m *managerImpl) IsStarredByUserCtx(ctx context.Context, query *starmodel.IsStarredByUserQuery) (bool, error) {
	return m.starStore.isStarredByUserCtx(ctx, query)
}

func (m *managerImpl) GetUserStars(ctx context.Context, cmd *starmodel.GetUserStarsQuery) (map[int64]bool, error) {
	return m.starStore.getUserStars(ctx, cmd)
}
