package plugins

import (
	"os"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

func ProvideAppInstaller() (*AppInstaller, error) {
	grafanaComAPIURL := os.Getenv("GRAFANA_COM_API_URL")
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	coreProvider := meta.NewCoreProvider()
	cloudProvider := meta.NewCloudProvider(grafanaComAPIURL)
	metaProviderManager := meta.NewProviderManager(coreProvider, cloudProvider)

	i, err := pluginsapp.ProvideAppInstaller(metaProviderManager)
	if err != nil {
		return nil, err
	}

	return &AppInstaller{
		AppInstaller: i,
	}, nil
}

// GetAuthorizer returns the authorizer for the plugins app.
func (p *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return pluginsapp.GetAuthorizer()
}
