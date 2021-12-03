package chats

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	Cfg     *setting.Cfg
	storage Storage
}

func ProvideService(cfg *setting.Cfg, store *sqlstore.SQLStore) *Service {
	s := &Service{
		Cfg: cfg,
		storage: &sqlStorage{
			sql: store,
		},
	}
	return s
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}
