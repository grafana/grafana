package installsync

import (
	"context"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	syncerLockActionName = "plugin-install-api-sync"
)

var (
	lockTimeout = 10 * time.Minute
)

// Syncer is the interface for syncing plugin installations to the Kubernetes-style API.
type Syncer interface {
	Sync(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error
}

// ServerLock is the interface for acquiring distributed locks.
type ServerLock interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

type syncer struct {
	featureToggles   featuremgmt.FeatureToggles
	clientGenerator  resource.ClientGenerator
	installRegistrar *install.InstallRegistrar
	orgService       org.Service
	namespaceMapper  request.NamespaceMapper
	serverLock       ServerLock
}

// newSyncer creates a new syncer with the provided dependencies.
func newSyncer(
	featureToggles featuremgmt.FeatureToggles,
	clientGenerator resource.ClientGenerator,
	installRegistrar *install.InstallRegistrar,
	orgService org.Service,
	namespaceMapper request.NamespaceMapper,
	serverLock ServerLock,
) *syncer {
	return &syncer{
		clientGenerator:  clientGenerator,
		featureToggles:   featureToggles,
		installRegistrar: installRegistrar,
		orgService:       orgService,
		namespaceMapper:  namespaceMapper,
		serverLock:       serverLock,
	}
}

// ProvideSyncer creates a new Syncer for syncing plugin installations to the API.
func ProvideSyncer(
	featureToggles featuremgmt.FeatureToggles,
	clientGenerator resource.ClientGenerator,
	orgService org.Service,
	cfgProvider configprovider.ConfigProvider,
	serverLock ServerLock,
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
	), nil
}

func (s *syncer) Sync(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	if !s.featureToggles.IsEnabled(ctx, featuremgmt.FlagPluginInstallAPISync) {
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

func (s *syncer) syncAllNamespaces(ctx context.Context, source install.Source, installedPlugins []*plugins.Plugin) error {
	orgs, err := s.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}

	for _, org := range orgs {
		err := s.syncNamespace(ctx, s.namespaceMapper(org.ID), source, installedPlugins)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *syncer) syncNamespace(ctx context.Context, namespace string, source install.Source, installedPlugins []*plugins.Plugin) error {
	client, err := s.installRegistrar.GetClient()
	if err != nil {
		return err
	}

	apiPlugins, err := client.ListAll(ctx, namespace, resource.ListOptions{})
	if err != nil {
		return err
	}

	installedMap := make(map[string]*plugins.Plugin)
	for _, p := range installedPlugins {
		installedMap[p.ID] = p
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
