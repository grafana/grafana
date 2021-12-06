package chats

import (
	"context"

	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg     *setting.Cfg
	live    *live.GrafanaLive
	storage Storage
}

func ProvideService(cfg *setting.Cfg, store *sqlstore.SQLStore, live *live.GrafanaLive) *Service {
	s := &Service{
		cfg:  cfg,
		live: live,
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
