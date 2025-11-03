package plugins

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	pluginsappapis "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
)

var (
	_ appsdkapiserver.AppInstaller    = (*PluginsAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*PluginsAppInstaller)(nil)
)

type PluginsAppInstaller struct {
	appsdkapiserver.AppInstaller
}

func ProvideAppInstaller() (*PluginsAppInstaller, error) {
	installer := &PluginsAppInstaller{}
	specificConfig := any(nil)
	provider := simple.NewAppProvider(pluginsappapis.LocalManifest(), specificConfig, pluginsapp.New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *pluginsappapis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, pluginsappapis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

// GetAuthorizer returns the authorizer for the plugins app.
func (p *PluginsAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return pluginsapp.GetAuthorizer()
}
