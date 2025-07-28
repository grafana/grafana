package shorturl

import (
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/shorturl/pkg/apis"
	shorturlapp "github.com/grafana/grafana/apps/shorturl/pkg/app"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type ShortURLAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg    *setting.Cfg
	logger log.Logger
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
) (*ShortURLAppInstaller, error) {
	installer := &ShortURLAppInstaller{
		cfg:    cfg,
		logger: log.New("shorturl::RawHandlers"),
	}
	specificConfig := any(&shorturlapp.ShortURLConfig{
		AppURL: cfg.AppURL,
	})
	provider := simple.NewAppProvider(apis.LocalManifest(), specificConfig, shorturlapp.New)

	appCfg := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appCfg, apis.ManifestGoTypeAssociator, apis.ManifestCustomRouteResponsesAssociator)
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
