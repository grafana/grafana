package appregistry

import (
	"context"

	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/registry/apps/correlations"
	"github.com/grafana/grafana/pkg/registry/apps/example"
	"github.com/grafana/grafana/pkg/registry/apps/investigations"
	"github.com/grafana/grafana/pkg/registry/apps/logsdrilldown"
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
	correlationsAppInstaller *correlations.AppInstaller,
	alertingNotificationAppInstaller *notifications.AlertingNotificationsAppInstaller,
	logsdrilldownAppInstaller *logsdrilldown.LogsDrilldownAppInstaller,
	annotationAppInstaller *annotation.AnnotationAppInstaller,
	exampleAppInstaller *example.ExampleAppInstaller,
	advisorAppInstaller *advisor.AdvisorAppInstaller,
) []appsdkapiserver.AppInstaller {
	installers := []appsdkapiserver.AppInstaller{
		playlistAppInstaller,
		pluginsApplInstaller,
		exampleAppInstaller,
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesShortURLs) {
		installers = append(installers, shorturlAppInstaller)
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesAlertingRules) && rulesAppInstaller != nil {
		installers = append(installers, rulesAppInstaller)
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesCorrelations) {
		installers = append(installers, correlationsAppInstaller)
	}
	if alertingNotificationAppInstaller != nil {
		installers = append(installers, alertingNotificationAppInstaller)
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesLogsDrilldown) {
		installers = append(installers, logsdrilldownAppInstaller)
	}
	//nolint:staticcheck
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesAnnotations) {
		installers = append(installers, annotationAppInstaller)
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagGrafanaAdvisor) {
		installers = append(installers, advisorAppInstaller)
	}

	return installers
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
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagInvestigationsBackend) {
		logger.Debug("Investigations backend is enabled")
		providers = append(providers, investigationAppProvider)
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
