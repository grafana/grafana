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
	"github.com/prometheus/client_golang/prometheus"

	pluginsapp "github.com/grafana/grafana/apps/plugins/pkg/app"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
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
	features featuremgmt.FeatureToggles, registerer prometheus.Registerer,
) (*AppInstaller, error) {
	metrics.MustRegister(registerer)

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagPluginStoreServiceLoading) {
		if err := registerAccessControlRoles(accessControlService); err != nil {
			return nil, fmt.Errorf("registering access control roles: %w", err)
		}
	}

	logger := logging.DefaultLogger.With("app", "plugins.app")

	localProvider := meta.NewLocalProvider(pluginStore, moduleHashCalc)
	coreProvider, err := meta.NewCoreProvider(logger, meta.CoreProviderOpts{
		StaticRootPath: func() (string, error) {
			return getStaticRootPath(cfgProvider, logger)
		},
	})
	if err != nil {
		return nil, err
	}
	if err = coreProvider.Init(context.Background()); err != nil {
		logger.Warn("Failed to eagerly load core plugins", "error", err)
	}
	metaProviderManager := meta.NewProviderManager(coreProvider, localProvider)
	authorizer := grafanaauthorizer.NewResourceAuthorizer(accessClient)
	i, err := pluginsapp.NewPluginsAppInstaller(logger, authorizer, metaProviderManager, false)
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

func getStaticRootPath(cfgProvider configprovider.ConfigProvider, logger logging.Logger) (string, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		wd, err := os.Getwd()
		if err != nil {
			return "", errors.New("getStaticRootPath fallback failed: could not determine working directory")
		}
		// Check if we're in the Grafana root
		staticRootPath := filepath.Join(wd, "public")
		if _, err = os.Stat(filepath.Join(staticRootPath, "app", "plugins")); err != nil {
			return "", errors.New("getStaticRootPath fallback failed: could not find core plugins directory")
		}
		return staticRootPath, nil
	}

	staticRootPath := cfg.StaticRootPath
	// cfg.HomePath may not be set correctly depending on the cfgProvider implementation
	if staticRootPath == "" || staticRootPath == "." || !filepath.IsAbs(staticRootPath) {
		staticRootPath = "/usr/share/grafana/public"
	}

	if _, err = os.Stat(filepath.Join(staticRootPath, "app", "plugins")); err != nil {
		return "", fmt.Errorf("could not find core plugins in directory %s", staticRootPath)
	}

	return staticRootPath, nil
}
