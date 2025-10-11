package appregistry

import (
	"context"
	"slices"
	"sync"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/correlations"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/plugins"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideAppInstallers returns a list of app installers that can be used to install apps.
// This is the pattern that should be used to provide app installers in the app registry.
func ProvideAppInstallers(
	features featuremgmt.FeatureToggles,
	playlistAppInstaller *playlist.PlaylistAppInstaller,
	pluginsApplInstaller *plugins.PluginsAppInstaller,
	shorturlAppInstaller *shorturl.ShortURLAppInstaller,
	rulesAppInstaller *rules.AlertingRulesAppInstaller,
	correlationsAppInstaller *correlations.CorrelationsAppInstaller,
	alertingNotificationAppInstaller *notifications.AlertingNotificationsAppInstaller,
) []appsdkapiserver.AppInstaller {
	installers := []appsdkapiserver.AppInstaller{
		playlistAppInstaller,
		pluginsApplInstaller,
	}
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs) {
		installers = append(installers, shorturlAppInstaller)
	}
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesAlertingRules) && rulesAppInstaller != nil {
		installers = append(installers, rulesAppInstaller)
	}
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesCorrelations) {
		installers = append(installers, correlationsAppInstaller)
	}
	if alertingNotificationAppInstaller != nil {
		installers = append(installers, alertingNotificationAppInstaller)
	}
	return installers
}

// ProvideClientGenerator creates a lazy-initialized ClientGenerator.
func ProvideClientGenerator(restConfigProvider apiserver.RestConfigProvider) resource.ClientGenerator {
	return &lazyClientGenerator{
		restConfigProvider: restConfigProvider,
	}
}

type lazyClientGenerator struct {
	restConfigProvider apiserver.RestConfigProvider
	clientGenerator    resource.ClientGenerator
	initOnce           sync.Once
	initError          error
}

func (g *lazyClientGenerator) ClientFor(kind resource.Kind) (resource.Client, error) {
	g.initOnce.Do(func() {
		restConfig, err := g.restConfigProvider.GetRestConfig(context.Background())
		if err != nil {
			g.initError = err
			return
		}
		restConfig.APIPath = "apis"
		g.clientGenerator = k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())
	})

	if g.initError != nil {
		return nil, g.initError
	}

	return g.clientGenerator.ClientFor(kind)
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
