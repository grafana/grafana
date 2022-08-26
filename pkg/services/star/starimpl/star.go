package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cstore compositeStore
}

func ProvideService(db db.DB, cfg *setting.Cfg) star.Service {
	cstore := compositeStore{stores: make(map[storageType]store)}
	if cfg.IsFeatureToggleEnabled("newDBLibrary") {
		cstore.stores[sqlTable] = &sqlxStore{
			sess: db.GetSqlxSession(),
		}
	} else {
		cstore.stores[sqlTable] = &sqlStore{
			db: db,
		}
	}
	return &Service{
		cstore: cstore,
	}
}

func (s *Service) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.cstore.Insert(ctx, cmd)
}

func (s *Service) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.cstore.Delete(ctx, cmd)
}

func (s *Service) IsStarredByUser(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	return s.cstore.Get(ctx, query)
}

func (s *Service) GetByUser(ctx context.Context, cmd *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return s.cstore.List(ctx, cmd)
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.cstore.DeleteByUser(ctx, userID)
}
