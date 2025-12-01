package installsync

import (
	"context"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	ServiceName          = "plugins.installsync"
	syncerLockActionName = "plugin-install-api-sync"
)

var (
	lockTimeout = 10 * time.Minute
)

// Syncer is the interface for syncing plugin installations to the Kubernetes-style API.
type Syncer interface {
	registry.BackgroundService
	registry.CanBeDisabled
	Sync(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error
}

// ServerLock is the interface for acquiring distributed locks.
type ServerLock interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

type syncer struct {
	services.NamedService
	featureToggles      featuremgmt.FeatureToggles
	clientGenerator     resource.ClientGenerator
	installRegistrar    *install.InstallRegistrar
	orgService          org.Service
	namespaceMapper     request.NamespaceMapper
	serverLock          ServerLock
	restConfigProvider  apiserver.RestConfigProvider
	pluginsStoreService pluginstore.Store
}

var _ Syncer = (*syncer)(nil)
var _ registry.BackgroundService = (*syncer)(nil)
var _ registry.CanBeDisabled = (*syncer)(nil)
var _ services.NamedService = (*syncer)(nil)

// newSyncer creates a new syncer with the provided dependencies.
func newSyncer(
	featureToggles featuremgmt.FeatureToggles,
	clientGenerator resource.ClientGenerator,
	installRegistrar *install.InstallRegistrar,
	orgService org.Service,
	namespaceMapper request.NamespaceMapper,
	serverLock ServerLock,
	restConfigProvider apiserver.RestConfigProvider,
	pluginsStoreService pluginstore.Store,
) *syncer {
	s := syncer{
		clientGenerator:     clientGenerator,
		featureToggles:      featureToggles,
		installRegistrar:    installRegistrar,
		orgService:          orgService,
		namespaceMapper:     namespaceMapper,
		serverLock:          serverLock,
		restConfigProvider:  restConfigProvider,
		pluginsStoreService: pluginsStoreService,
	}
	s.NamedService = services.NewBasicService(nil, s.running, nil).WithName(ServiceName)
	return &s
}

// ProvideSyncer creates a new Syncer for syncing plugin installations to the API.
func ProvideSyncer(
	featureToggles featuremgmt.FeatureToggles,
	clientGenerator resource.ClientGenerator,
	orgService org.Service,
	cfgProvider configprovider.ConfigProvider,
	serverLock ServerLock,
	restConfigProvider apiserver.RestConfigProvider,
	pluginsStoreService pluginstore.Store,
) (Syncer, error) {
	cfg, err := cfgProvider.Get(context.Background())
	if err != nil {
		return nil, err
	}
	installRegistrar := install.NewInstallRegistrar(clientGenerator)
	namespaceMapper := request.GetNamespaceMapper(cfg)

	return newSyncer(
		featureToggles,
		clientGenerator,
		installRegistrar,
		orgService,
		namespaceMapper,
		serverLock,
		restConfigProvider,
		pluginsStoreService,
	), nil
}

func (s *syncer) IsDisabled() bool {
	//nolint:staticcheck // not yet migrated to OpenFeature
	syncEnabled := s.featureToggles.IsEnabled(context.Background(), featuremgmt.FlagPluginInstallAPISync)
	//nolint:staticcheck // not yet migrated to OpenFeature
	serviceLoadingEnabled := s.featureToggles.IsEnabled(context.Background(), featuremgmt.FlagPluginStoreServiceLoading)
	return !syncEnabled || !serviceLoadingEnabled
}

func (s *syncer) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	return s.AwaitTerminated(context.Background())
}

func (s *syncer) running(ctx context.Context) error {
	ctxLog := logging.FromContext(ctx)
	restConfig, err := s.restConfigProvider.GetRestConfig(ctx)
	if err != nil {
		return err
	}
	discoveryClient, err := client.NewDiscoveryClient(restConfig)
	if err != nil {
		ctxLog.Warn("Failed to create discovery client, skipping plugin sync", "error", err)
	}
	if err := discoveryClient.WaitForAvailability(ctx, pluginsv0alpha1.PluginKind().GroupVersionKind().GroupVersion()); err != nil {
		ctxLog.Warn("Failed to wait for plugin API availability, skipping plugin sync", "error", err)
	}

	if err := s.Sync(ctx, install.SourcePluginStore, s.pluginsStoreService.Plugins(ctx)); err != nil {
		ctxLog.Warn("Failed to sync plugins", "error", err)
	}
	<-ctx.Done()
	return nil
}

func (s *syncer) Sync(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error {
	if s.IsDisabled() {
		return nil
	}

	if len(installedPlugins) == 0 {
		return nil
	}

	var syncErr error
	lockErr := s.serverLock.LockExecuteAndRelease(ctx, syncerLockActionName, lockTimeout, func(ctx context.Context) {
		syncErr = s.syncAllNamespaces(ctx, source, installedPlugins)
	})

	if lockErr != nil {
		return lockErr
	}
	return syncErr
}

func (s *syncer) syncAllNamespaces(ctx context.Context, source install.Source, installedPlugins []pluginstore.Plugin) error {
	orgs, err := s.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, org := range orgs {
		ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, s.namespaceMapper(org.ID))
		err := s.syncNamespace(ctx, s.namespaceMapper(org.ID), source, installedPlugins)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *syncer) syncNamespace(ctx context.Context, namespace string, source install.Source, installedPlugins []pluginstore.Plugin) error {
	client, err := s.installRegistrar.GetClient()
	if err != nil {
		return err
	}

	apiPlugins, err := client.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return err
	}

	installedMap := make(map[string]struct{})
	for _, p := range installedPlugins {
		installedMap[p.ID] = struct{}{}
	}

	// unregister plugins that are not installed
	for _, apiPlugin := range apiPlugins.Items {
		if _, exists := installedMap[apiPlugin.Spec.Id]; !exists {
			err := s.installRegistrar.Unregister(ctx, namespace, apiPlugin.Spec.Id, source)
			if err != nil {
				return err
			}
		}
	}

	// register plugins that are installed
	for _, p := range installedPlugins {
		err := s.installRegistrar.Register(ctx, namespace, &install.PluginInstall{
			ID:      p.ID,
			Version: p.Info.Version,
			Class:   install.Class(p.Class),
			Source:  source,
		})
		if err != nil {
			return err
		}
	}

	return nil
}
