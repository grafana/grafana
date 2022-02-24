package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
)

type serviceImpl struct {
	starStore store
}

func ProvideService(sqlstore sqlstore.Store) star.Service {
	s := &serviceImpl{starStore: newStarStore(sqlstore)}
	return s
}

func (s *serviceImpl) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.starStore.create(ctx, cmd)
}

func (s *serviceImpl) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.starStore.delete(ctx, cmd)
}

func (s *serviceImpl) IsStarredByUser(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	return s.starStore.get(ctx, query)
}

func (s *serviceImpl) GetByUser(ctx context.Context, cmd *star.GetUserStarsQuery) (star.GetUserStarsResult, error) {
	return s.starStore.list(ctx, cmd)
}
