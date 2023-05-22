package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/services/teamguardian"
)

type Service struct {
	store teamguardian.Store
}

func ProvideService(store teamguardian.Store) teamguardian.TeamGuardian {
	return &Service{store: store}
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.store.DeleteByUser(ctx, userID)
}
