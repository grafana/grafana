package plugins

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
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
	i, err := pluginsapp.ProvideAppInstaller(nil)
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
