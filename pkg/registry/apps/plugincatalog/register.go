package plugincatalog

import (
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	plugincatalogapp "github.com/grafana/grafana/apps/plugincatalog/pkg/app"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*PluginCatalogAppInstaller)(nil)
)

type PluginCatalogAppInstaller struct {
	appsdkapiserver.AppInstaller
}

func RegisterAppInstaller(
	_ *setting.Cfg,
) (*PluginCatalogAppInstaller, error) {
	// Sync is disabled by default, so no fetcher needed
	catalogInstaller, err := plugincatalogapp.ProvideAppInstaller(
		nil, // fetcher only needed when sync enabled
		plugincatalogapp.DefaultConfig(),
		false,
	)
	if err != nil {
		return nil, err
	}

	return &PluginCatalogAppInstaller{
		AppInstaller: catalogInstaller,
	}, nil
}
