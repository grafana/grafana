package appregistry

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"k8s.io/client-go/rest"
)

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct {
	runner *runner.APIGroupRunner
}

// ProvideRegistryServiceSink is an entry point for each service that will force initialization
func ProvideRegistryServiceSink(
	registrar builder.APIRegistrar,
	restConfigProvider apiserver.RestConfigProvider,
	playlistAppProvider *playlist.PlaylistAppProvider,
) (*Service, error) {
	cfgWrapper := func(ctx context.Context) *rest.Config {
		cfg := restConfigProvider.GetRestConfig(ctx)
		if cfg == nil {
			return nil
		}
		cfg.APIPath = "/apis"
		return cfg
	}

	cfg := runner.RunnerConfig{
		RestConfigGetter: cfgWrapper,
		APIRegistrar:     registrar,
	}
	runner, err := runner.NewAPIGroupRunner(cfg, playlistAppProvider)
	if err != nil {
		return nil, err
	}
	return &Service{runner: runner}, nil
}

func (s *Service) Run(ctx context.Context) error {
	if err := s.runner.Init(ctx); err != nil {
		return err
	}
	return s.runner.Run(ctx)
}
