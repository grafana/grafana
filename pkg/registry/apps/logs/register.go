package logs

import (
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/logs/pkg/apis"
	logsapp "github.com/grafana/grafana/apps/logs/pkg/app"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
    _ appsdkapiserver.AppInstaller = (*LogsAppInstaller)(nil)
)

type LogsAppInstaller struct {
    appsdkapiserver.AppInstaller
    cfg *setting.Cfg
}

func RegisterAppInstaller(
    cfg *setting.Cfg,
    features featuremgmt.FeatureToggles,
) (*LogsAppInstaller, error) {
    installer := &LogsAppInstaller{
        cfg: cfg,
    }
    provider := simple.NewAppProvider(apis.LocalManifest(), nil, logsapp.New)

    appConfig := app.Config{
        KubeConfig:   restclient.Config{}, // this will be overridden by the installer's InitializeApp method
        ManifestData: *apis.LocalManifest().ManifestData,
    }
    i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
    if err != nil {
        return nil, err
    }
    installer.AppInstaller = i

    return installer, nil
}
