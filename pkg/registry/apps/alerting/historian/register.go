package historian

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis"
	historianApp "github.com/grafana/grafana/apps/alerting/historian/pkg/app"
	historianAppConfig "github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AlertingHistorianAppInstaller)(nil)
)

type AlertingHistorianAppInstaller struct {
	appsdkapiserver.AppInstaller
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) (*AlertingHistorianAppInstaller, error) {
	if ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting Historian apiserver (historian.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	installer := &AlertingHistorianAppInstaller{}

	handlers := &handlers{
		historian: ng.Api.Historian,
	}

	appSpecificConfig := historianAppConfig.RuntimeConfig{
		GetAlertStateHistoryHandler: handlers.GetAlertStateHistoryHandler,
	}

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
