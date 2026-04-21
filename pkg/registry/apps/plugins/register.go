package plugins

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	authlib "github.com/grafana/authlib/types"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/prometheus/client_golang/prometheus"

	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginassets/modulehash"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	metaManager *meta.ProviderManager
	cfgProvider configprovider.ConfigProvider

	*pluginsapp.PluginAppInstaller
}

func ProvideAppInstaller(
	cfgProvider configprovider.ConfigProvider,
	clientGenerator resource.ClientGenerator,
	pluginStore pluginstore.Store, moduleHashCalc *modulehash.Calculator,
	accessControlService accesscontrol.Service, accessClient authlib.AccessClient,
	features featuremgmt.FeatureToggles, registerer prometheus.Registerer,
	pluginInstaller plugins.Installer,
) (*AppInstaller, error) {
	metrics.MustRegister(registerer)

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagPluginStoreServiceLoading) {
		if err := registerAccessControlRoles(accessControlService); err != nil {
			return nil, fmt.Errorf("registering access control roles: %w", err)
		}
	}

	logger := logging.DefaultLogger.With("app", "plugins.app")

	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}

	localProvider := meta.NewLocalProvider(pluginStore, moduleHashCalc)
	coreProvider := meta.NewCoreProvider(logger, func() (string, error) {
		return getPluginsPath(cfg)
	})
	if err := coreProvider.Init(context.Background()); err != nil {
		logger.Warn("Failed to eagerly load core plugins", "error", err)
	}
	metaProviderManager := meta.NewProviderManager(coreProvider, localProvider)
	authorizer := grafanaauthorizer.NewResourceAuthorizer(accessClient)
	registrar := install.NewInstallRegistrar(logger, clientGenerator)

	// Create single-tenant lifecycle manager for on-prem deployments
	pluginLifecycle := install.NewLocalManager(pluginInstaller, pluginStore, registrar, cfg.BuildVersion, logger)

	i, err := pluginsapp.NewPluginsAppInstaller(logger, authorizer, metaProviderManager, false, pluginLifecycle)
	if err != nil {
		return nil, err
	}

	return &AppInstaller{
		metaManager:        metaProviderManager,
		cfgProvider:        cfgProvider,
		PluginAppInstaller: i,
	}, nil
}

func getPluginsPath(cfg *setting.Cfg) (string, error) {
	pluginsPath := filepath.Join(cfg.StaticRootPath, "app", "plugins")
	if _, err := os.Stat(pluginsPath); err != nil {
		return "", errors.New("could not find core plugins directory")
	}

	return pluginsPath, nil
}
