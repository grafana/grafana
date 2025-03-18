package appregistry

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apps/investigation"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"k8s.io/client-go/rest"
)

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct {
	runner *runner.APIGroupRunner
	log    log.Logger
}

// ProvideRegistryServiceSink is an entry point for each service that will force initialization
func ProvideRegistryServiceSink(
	registrar builder.APIRegistrar,
	restConfigProvider apiserver.RestConfigProvider,
	features featuremgmt.FeatureToggles,
	playlistAppProvider *playlist.PlaylistAppProvider,
	investigationAppProvider *investigation.InvestigationAppProvider,
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

	var apiGroupRunner *runner.APIGroupRunner
	var err error
	if features.IsEnabledGlobally(featuremgmt.FlagInvestigationsBackend) {
		apiGroupRunner, err = runner.NewAPIGroupRunner(cfg, playlistAppProvider, investigationAppProvider)
	} else {
		apiGroupRunner, err = runner.NewAPIGroupRunner(cfg, playlistAppProvider)
	}

	if err != nil {
		return nil, err
	}
	return &Service{runner: apiGroupRunner, log: log.New("app-registry")}, nil
}

func (s *Service) Run(ctx context.Context) error {
	s.log.Debug("initializing app registry")
	if err := s.runner.Init(ctx); err != nil {
		return err
	}
	s.log.Info("app registry initialized")
	return s.runner.Run(ctx)
}
