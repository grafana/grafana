package appregistry

import (
	"context"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideAppInstallers returns a list of app installers that can be used to install apps.
// This is the pattern that should be used to provide app installers in the app registry.
func ProvideAppInstallers(
	playlistAppInstaller *playlist.PlaylistAppInstaller,
) []appsdkapiserver.AppInstaller {
	return []appsdkapiserver.AppInstaller{playlistAppInstaller}
}

var (
	_ registry.BackgroundService = (*Service)(nil)
)

type Service struct {
	runner *runner.APIGroupRunner
	log    log.Logger
}

// ProvideBuilderRunners adapts apps to the APIGroupBuilder interface.
// deprecated: Use ProvideAppInstallers instead.
func ProvideBuilderRunners(
	registrar builder.APIRegistrar,
	restConfigProvider apiserver.RestConfigProvider,
	features featuremgmt.FeatureToggles,
	investigationAppProvider *investigations.InvestigationsAppProvider,
	advisorAppProvider *advisor.AdvisorAppProvider,
	alertingNotificationsAppProvider *notifications.AlertingNotificationsAppProvider,
	grafanaCfg *setting.Cfg,
) (*Service, error) {
	cfgWrapper := func(ctx context.Context) (*rest.Config, error) {
		cfg, err := restConfigProvider.GetRestConfig(ctx)
		if err != nil {
			return nil, err
		}
		cfg.APIPath = "/apis"
		return cfg, nil
	}

	cfg := runner.RunnerConfig{
		RestConfigGetter: cfgWrapper,
		APIRegistrar:     registrar,
	}
	logger := log.New("app-registry")
	var apiGroupRunner *runner.APIGroupRunner
	var err error
	providers := []app.Provider{}
	if features.IsEnabledGlobally(featuremgmt.FlagInvestigationsBackend) {
		logger.Debug("Investigations backend is enabled")
		providers = append(providers, investigationAppProvider)
	}
	if features.IsEnabledGlobally(featuremgmt.FlagGrafanaAdvisor) &&
		!slices.Contains(grafanaCfg.DisablePlugins, "grafana-advisor-app") {
		providers = append(providers, advisorAppProvider)
	}
	if alertingNotificationsAppProvider != nil {
		providers = append(providers, alertingNotificationsAppProvider)
	}
	apiGroupRunner, err = runner.NewAPIGroupRunner(cfg, providers...)

	if err != nil {
		return nil, err
	}
	return &Service{runner: apiGroupRunner, log: logger}, nil
}

func (s *Service) Run(ctx context.Context) error {
	s.log.Debug("initializing app registry")
	if err := s.runner.Init(ctx); err != nil {
		return err
	}
	s.log.Info("app registry initialized")
	return s.runner.Run(ctx)
}
