package userauthimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/userauth"
)

type Service struct {
	store store
}

func ProvideService(db db.DB) userauth.Service {
	return &Service{
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) Delete(ctx context.Context, userID int64) error {
	return s.store.Delete(ctx, userID)
}

func (s *Service) DeleteToken(ctx context.Context, userID int64) error {
	return s.store.DeleteToken(ctx, userID)
}
