package plugins

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	authlib "github.com/grafana/authlib/types"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins/pluginassets/modulehash"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	pluginStore pluginstore.Store, moduleHashCalc *modulehash.Calculator,
	accessControlService accesscontrol.Service, accessClient authlib.AccessClient,
	features featuremgmt.FeatureToggles,
) (*AppInstaller, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagPluginStoreServiceLoading) {
		if err := registerAccessControlRoles(accessControlService); err != nil {
			return nil, fmt.Errorf("registering access control roles: %w", err)
		}
	}

	localProvider := meta.NewLocalProvider(pluginStore, moduleHashCalc)
	coreProvider := meta.NewCoreProvider(func() (string, error) {
		return getPluginsPath(cfgProvider)
	})
	metaProviderManager := meta.NewProviderManager(coreProvider, localProvider)
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

func getPluginsPath(cfgProvider configprovider.ConfigProvider) (string, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		wd, err := os.Getwd()
		if err != nil {
			return "", errors.New("getPluginsPath fallback failed: could not determine working directory")
		}
		// Check if we're in the Grafana root
		pluginsPath := filepath.Join(wd, "public", "app", "plugins")
		if _, err = os.Stat(pluginsPath); err != nil {
			return "", errors.New("getPluginsPath fallback failed: could not find core plugins directory")
		}
		return pluginsPath, nil
	}

	pluginsPath := filepath.Join(cfg.StaticRootPath, "public", "app", "plugins")
	if _, err = os.Stat(pluginsPath); err != nil {
		return "", errors.New("could not find core plugins directory")
	}

	return pluginsPath, nil
}
