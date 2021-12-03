package chats

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	Cfg      *setting.Cfg
	SQLStore *sqlstore.SQLStore
}

func ProvideService(cfg *setting.Cfg, store *sqlstore.SQLStore) *Service {
	s := &Service{
		Cfg:      cfg,
		SQLStore: store,
	}
	return s
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}
