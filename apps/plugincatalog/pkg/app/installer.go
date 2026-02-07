package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	restclient "k8s.io/client-go/rest"

	plugincatalogapis "github.com/grafana/grafana/apps/plugincatalog/pkg/apis"
)

// ProvideAppInstaller creates and returns the app installer for the plugin catalog app
func ProvideAppInstaller(
	fetcher PluginCatalogFetcher,
	config Config,
	enableSync bool,
) (appsdkapiserver.AppInstaller, error) {
	specificConfig := &PluginCatalogAppConfig{
		Fetcher:    fetcher,
		Config:     config,
		EnableSync: enableSync,
	}

	provider := simple.NewAppProvider(
		plugincatalogapis.LocalManifest(),
		specificConfig,
		New,
	)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // Will be overridden by installer
		ManifestData:   *plugincatalogapis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}

	return appsdkapiserver.NewDefaultAppInstaller(
		provider,
		appConfig,
		plugincatalogapis.NewGoTypeAssociator(),
	)
}
