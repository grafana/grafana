package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations"
	"github.com/grafana/grafana/pkg/services/star"
)

type Service struct {
	store  store
	logger log.Logger
}

func ProvideService(db db.DB) star.Service {
	starLogger := log.New("stars")
	// fill out dashboard_uid, org_id and updated columns for stars
	// need to run this at startup in case any downgrade happened after
	// the initial migration
	err := migrations.RunStarMigrations(db.GetEngine().NewSession(), db.GetDialect().DriverName())
	if err != nil {
		starLogger.Error("Failed to run star migrations", "err", err)
	}
	return &Service{
		store: &sqlStore{
			db: db,
		},
		logger: starLogger,
	}
}

func (s *Service) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.store.Insert(ctx, cmd)
}

func (s *Service) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.store.Delete(ctx, cmd)
}

func (s *Service) IsStarredByUser(ctx context.Context, query *star.IsStarredByUserQuery) (bool, error) {
	return s.store.Get(ctx, query)
}

func (s *Service) GetByUser(ctx context.Context, cmd *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return s.store.List(ctx, cmd)
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.store.DeleteByUser(ctx, userID)
}
