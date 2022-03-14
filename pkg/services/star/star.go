package star

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	starmodel "github.com/grafana/grafana/pkg/services/star/model"
)

type Service interface {
	StarDashboard(ctx context.Context, cmd *starmodel.StarDashboardCommand) error
	UnstarDashboard(ctx context.Context, cmd *starmodel.UnstarDashboardCommand) error
	IsStarredByUserCtx(ctx context.Context, query *starmodel.IsStarredByUserQuery) (bool, error)
	GetUserStars(ctx context.Context, cmd *starmodel.GetUserStarsQuery) (map[int64]bool, error)
}

type serviceImpl struct {
	starStore store
}

func ProvideService(sqlstore sqlstore.Store) Service {
	m := &serviceImpl{starStore: newStarStore(sqlstore)}
	return m
}

func (m *serviceImpl) StarDashboard(ctx context.Context, cmd *starmodel.StarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return starmodel.ErrCommandValidationFailed
	}
	return m.starStore.insert(ctx, cmd)
}

func (m *serviceImpl) UnstarDashboard(ctx context.Context, cmd *starmodel.UnstarDashboardCommand) error {
	if cmd.DashboardId == 0 || cmd.UserId == 0 {
		return starmodel.ErrCommandValidationFailed
	}
	return m.starStore.delete(ctx, cmd)
}

func (m *serviceImpl) IsStarredByUserCtx(ctx context.Context, query *starmodel.IsStarredByUserQuery) (bool, error) {
	return m.starStore.isStarredByUserCtx(ctx, query)
}

func (m *serviceImpl) GetUserStars(ctx context.Context, cmd *starmodel.GetUserStarsQuery) (map[int64]bool, error) {
	return m.starStore.getUserStars(ctx, cmd)
}
