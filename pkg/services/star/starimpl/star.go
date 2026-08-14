package starimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/star"
)

type Service struct {
	store  store
	db     db.DB
	logger log.Logger
}

func ProvideService(db db.DB) star.Service {
	starLogger := log.New("stars")
	return &Service{
		store: &sqlStore{
			db: db,
		},
		db:     db,
		logger: starLogger,
	}
}

func (s *Service) Add(ctx context.Context, cmd *star.StarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	err := s.store.Insert(ctx, cmd)
	if s.db.GetDialect().IsUniqueConstraintViolation(err) {
		return nil
	}
	return err
}

func (s *Service) Delete(ctx context.Context, cmd *star.UnstarDashboardCommand) error {
	if err := cmd.Validate(); err != nil {
		return err
	}
	return s.store.Delete(ctx, cmd)
}

func (s *Service) GetByUser(ctx context.Context, cmd *star.GetUserStarsQuery) (*star.GetUserStarsResult, error) {
	return s.store.List(ctx, cmd)
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.store.DeleteByUser(ctx, userID)
}
