package grpcserver

import (
	"context"

	ent "github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/services/entity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type EntityService struct {
	cfg   *setting.Cfg
	store entity.EntityStore
}

func ProvideEntityService(cfg *setting.Cfg, grpcServerProvider Provider, entityStore entity.EntityStore) (*EntityService, error) {
	ent.RegisterEntityStoreServer(grpcServerProvider.GetServer(), &EntityServer{entityStore})
	return &EntityService{
		cfg:   cfg,
		store: entityStore,
	}, nil
}

func (s *EntityService) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *EntityService) IsDisabled() bool {
	if s.cfg == nil {
		return true
	}
	return !s.cfg.IsFeatureToggleEnabled(featuremgmt.FlagGrpcServer)
}

type EntityServer struct {
	entity.EntityStore
}
