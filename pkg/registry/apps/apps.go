package appregistry

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/historian"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/notifications"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules"
	"github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/registry/apps/correlations"
	"github.com/grafana/grafana/pkg/registry/apps/dashvalidator"
	"github.com/grafana/grafana/pkg/registry/apps/example"
	"github.com/grafana/grafana/pkg/registry/apps/live"
	"github.com/grafana/grafana/pkg/registry/apps/logsdrilldown"
	"github.com/grafana/grafana/pkg/registry/apps/playlist"
	"github.com/grafana/grafana/pkg/registry/apps/plugins"
	"github.com/grafana/grafana/pkg/registry/apps/quotas"
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
	cfg *setting.Cfg,
	playlistAppInstaller *playlist.AppInstaller,
	pluginsAppInstaller *plugins.AppInstaller,
	liveAppInstaller *live.AppInstaller,
	shorturlAppInstaller *shorturl.ShortURLAppInstaller,
	rulesAppInstaller *rules.AppInstaller,
	correlationsAppInstaller *correlations.AppInstaller,
	alertingNotificationAppInstaller *notifications.AppInstaller,
	logsdrilldownAppInstaller *logsdrilldown.LogsDrilldownAppInstaller,
	annotationAppInstaller *annotation.AppInstaller,
	exampleAppInstaller *example.AppInstaller,
	advisorAppInstaller *advisor.AppInstaller,
	alertingHistorianAppInstaller *historian.AppInstaller,
	quotasAppInstaller *quotas.QuotasAppInstaller,
	dashvalidatorAppInstaller *dashvalidator.DashValidatorAppInstaller,
) []appsdkapiserver.AppInstaller {
	featureClient := openfeature.NewDefaultClient()
	installers := []appsdkapiserver.AppInstaller{
		playlistAppInstaller,
		pluginsAppInstaller,
		exampleAppInstaller,
	}
	if featureClient.Boolean(context.Background(), featuremgmt.FlagKubernetesUnifiedStorageQuotas, false, openfeature.TransactionContext(context.Background())) {
		installers = append(installers, quotasAppInstaller)
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

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagGrafanaAdvisor) {
		installers = append(installers, advisorAppInstaller)
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesAlertingHistorian) && alertingHistorianAppInstaller != nil {
		installers = append(installers, alertingHistorianAppInstaller)
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagLiveAPIServer) {
		installers = append(installers, liveAppInstaller)
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagDashboardValidatorApp) {
		installers = append(installers, dashvalidatorAppInstaller)
	}

	// Applications under active development should be disabled by default
	// and enabled in a dedicated section of **config.ini**.
	//
	// We kindly ask developers not to rely on `features.IsEnabledGlobally` to control app registration
	// as this API has been deprecated and will be removed in future releases.
	//
	// Developers are encouraged to explore the built-in functionality of the App Platform
	// to control the app registration (see `docs/apps/example/README.md`).
	if cfg.KubernetesAnnotationsAppEnabled {
		installers = append(installers, annotationAppInstaller)
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
