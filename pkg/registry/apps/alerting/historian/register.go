package historian

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis"
	historianApp "github.com/grafana/grafana/apps/alerting/historian/pkg/app"
	historianAppConfig "github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiconfig"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AlertingHistorianAppInstaller)(nil)
)

type AlertingHistorianAppInstaller struct {
	appsdkapiserver.AppInstaller
}

func (a *AlertingHistorianAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	)
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AlertingHistorianAppInstaller, error) {
	appSpecificConfig := historianAppConfig.RuntimeConfig{}

	// If we're provided some config, then we can enable some things.
	if cfg != nil {
		nhCfg := cfg.UnifiedAlerting.NotificationHistory

		// Only parse config if enabled.
		if nhCfg.Enabled {
			lokiConfig, err := lokiconfig.NewLokiConfig(cfg.UnifiedAlerting.NotificationHistory.LokiSettings)
			if err != nil {
				return nil, err
			}

			appSpecificConfig.Notification = historianAppConfig.NotificationConfig{
				Enabled: nhCfg.Enabled,
				Loki: historianAppConfig.LokiConfig{
					LokiConfig: lokiConfig,
				},
			}
		}
	}

	// If we're provided an AlertNG, then call back into that for things we need.
	// This is a temporary whilst building out the app; we should not depend on it.
	if ng != nil {
		if ng.IsDisabled() {
			log.New("app-registry").Info("Skipping Kubernetes Alerting Historian apiserver (historian.alerting.grafana.app): Unified Alerting is disabled")
			return nil, nil
		}

		handlers := &handlers{
			historian: ng.Api.Historian,
		}
		appSpecificConfig.GetAlertStateHistoryHandler = handlers.GetAlertStateHistoryHandler
	}

	return NewAppInstaller(appSpecificConfig)
}

func NewAppInstaller(appSpecificConfig historianAppConfig.RuntimeConfig) (*AlertingHistorianAppInstaller, error) {
	installer := &AlertingHistorianAppInstaller{}

	provider := simple.NewAppProvider(apis.LocalManifest(), appSpecificConfig, historianApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{},
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: appSpecificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
