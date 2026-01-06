package plugins

import (
	"fmt"

	authlib "github.com/grafana/authlib/types"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	metaManager        *meta.ProviderManager
	cfgProvider        configprovider.ConfigProvider
	restConfigProvider apiserver.RestConfigProvider

	*pluginsapp.PluginAppInstaller
}

func ProvideAppInstaller(
	cfgProvider configprovider.ConfigProvider,
	restConfigProvider apiserver.RestConfigProvider,
	pluginStore pluginstore.Store,
	pluginAssetsService *pluginassets.Service,
	accessControlService accesscontrol.Service, accessClient authlib.AccessClient,
) (*AppInstaller, error) {
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	localProvider := meta.NewLocalProvider(pluginStore, pluginAssetsService)
	metaProviderManager := meta.NewProviderManager(localProvider)
	authorizer := grafanaauthorizer.NewResourceAuthorizer(accessClient)
	i, err := pluginsapp.ProvideAppInstaller(authorizer, metaProviderManager)
	if err != nil {
		return nil, err
	}

	return &AppInstaller{
		metaManager:        metaProviderManager,
		cfgProvider:        cfgProvider,
		restConfigProvider: restConfigProvider,
		PluginAppInstaller: i,
	}, nil
}
