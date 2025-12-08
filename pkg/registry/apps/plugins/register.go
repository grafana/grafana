package plugins

import (
	"fmt"
	"os"

	authlib "github.com/grafana/authlib/types"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	*pluginsapp.PluginAppInstaller
}

func ProvideAppInstaller(accessControlService accesscontrol.Service, accessClient authlib.AccessClient) (*AppInstaller, error) {
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	grafanaComAPIURL := os.Getenv("GRAFANA_COM_API_URL")
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	coreProvider := meta.NewCoreProvider()
	cloudProvider := meta.NewCatalogProvider(grafanaComAPIURL)
	metaProviderManager := meta.NewProviderManager(coreProvider, cloudProvider)

	i, err := pluginsapp.ProvideAppInstaller(metaProviderManager)
	if err != nil {
		return nil, err
	}

	i.WithAccessChecker(accessClient)

	return &AppInstaller{
		PluginAppInstaller: i,
	}, nil
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return pluginsapp.GetAuthorizer()
}
