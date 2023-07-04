package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
}

func ProvideService(db db.DB, cfg *setting.Cfg) star.Service {
	if cfg.IsFeatureToggleEnabled(featuremgmt.FlagNewDBLibrary) {
		return &Service{
			store: &sqlxStore{
				sess: db.GetSqlxSession(),
				db:   db,
			},
		}
	}
	return &Service{
		store: &sqlStore{
			db: db,
		},
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
