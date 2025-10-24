package pluginstore

import (
	"context"
	"sort"
	"time"

	"github.com/grafana/dskit/services"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/installsync"
)

var _ Store = (*Service)(nil)

const ServiceName = "plugins.store"

// Store is the publicly accessible storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	// Note: version is not required since Grafana only supports single versions of a plugin.
	Plugin(ctx context.Context, pluginID string) (Plugin, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin
}

type Service struct {
	services.NamedService

	pluginRegistry    registry.Service
	pluginLoader      loader.Service
	pluginSources     sources.Registry
	installsRegistrar installsync.Syncer
	loadOnStartup     bool
}

func ProvideService(pluginRegistry registry.Service, pluginSources sources.Registry,
	pluginLoader loader.Service, installsRegistrar installsync.Syncer, features featuremgmt.FeatureToggles) (*Service, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagPluginStoreServiceLoading) {
		s := New(pluginRegistry, pluginLoader, pluginSources, installsRegistrar)
		s.loadOnStartup = true
		return s, nil
	}

	ctx := context.Background()
	start := time.Now()
	totalPlugins := 0
	logger := log.New("plugin.store")
	logger.Info("Loading plugins...")

	loadedPluginsToSync := make([]*plugins.Plugin, 0)
	for _, ps := range pluginSources.List(ctx) {
		loadedPlugins, err := pluginLoader.Load(ctx, ps)
		if err != nil {
			logger.Error("Loading plugin source failed", "source", ps.PluginClass(ctx), "error", err)
			return nil, err
		}
		loadedPluginsToSync = append(loadedPluginsToSync, loadedPlugins...)
		totalPlugins += len(loadedPlugins)
	}

	if err := installsRegistrar.Sync(ctx, install.SourcePluginStore, loadedPluginsToSync); err != nil {
		logger.Error("Syncing plugin installations failed", "error", err)
	}

	logger.Info("Plugins loaded", "count", totalPlugins, "duration", time.Since(start))

	return New(pluginRegistry, pluginLoader, pluginSources, installsRegistrar), nil
}

func (s *Service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	stopCtx := context.Background()
	return s.AwaitTerminated(stopCtx)
}

func NewPluginStoreForTest(pluginRegistry registry.Service, pluginLoader loader.Service, pluginSources sources.Registry, installsRegistrar installsync.Syncer) (*Service, error) {
	s := New(pluginRegistry, pluginLoader, pluginSources, installsRegistrar)
	s.loadOnStartup = true
	if err := s.StartAsync(context.Background()); err != nil {
		return nil, err
	}
	if err := s.AwaitRunning(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func New(pluginRegistry registry.Service, pluginLoader loader.Service, pluginSources sources.Registry, installsRegistrar installsync.Syncer) *Service {
	s := &Service{
		pluginRegistry:    pluginRegistry,
		pluginLoader:      pluginLoader,
		pluginSources:     pluginSources,
		installsRegistrar: installsRegistrar,
	}
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(ServiceName)
	return s
}

func (s *Service) starting(ctx context.Context) error {
	if !s.loadOnStartup {
		return nil
	}
	start := time.Now()
	totalPlugins := 0
	logger := log.New(ServiceName)
	logger.Info("Loading plugins...")

	loadedPluginsToSync := make([]*plugins.Plugin, 0)
	for _, ps := range s.pluginSources.List(ctx) {
		loadedPlugins, err := s.pluginLoader.Load(ctx, ps)
		if err != nil {
			logger.Error("Loading plugin source failed", "source", ps.PluginClass(ctx), "error", err)
			return err
		}
		loadedPluginsToSync = append(loadedPluginsToSync, loadedPlugins...)
		totalPlugins += len(loadedPlugins)
	}

	if err := s.installsRegistrar.Sync(ctx, install.SourcePluginStore, loadedPluginsToSync); err != nil {
		logger.Error("Syncing plugin installations failed", "error", err)
	}

	logger.Info("Plugins loaded", "count", totalPlugins, "duration", time.Since(start))
	return nil
}

func (s *Service) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

func (s *Service) stopping(failureReason error) error {
	return s.shutdown(context.Background())
}

func (s *Service) Plugin(ctx context.Context, pluginID string) (Plugin, bool) {
	if err := s.AwaitRunning(ctx); err != nil {
		log.New(ServiceName).FromContext(ctx).Error("Failed to get plugin", "error", err)
		return Plugin{}, false
	}
	p, exists := s.plugin(ctx, pluginID)
	if !exists {
		return Plugin{}, false
	}

	return ToGrafanaDTO(p), true
}

func (s *Service) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin {
	if err := s.AwaitRunning(ctx); err != nil {
		log.New(ServiceName).FromContext(ctx).Error("Failed to get plugins", "error", err)
		return []Plugin{}
	}
	// if no types passed, assume all
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	var requestedTypes = make(map[plugins.Type]struct{})
	for _, pt := range pluginTypes {
		requestedTypes[pt] = struct{}{}
	}

	pluginsList := make([]Plugin, 0)
	for _, p := range s.availablePlugins(ctx) {
		if _, exists := requestedTypes[p.Type]; exists {
			pluginsList = append(pluginsList, ToGrafanaDTO(p))
		}
	}
	return pluginsList
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID, "") // version is not required since Grafana only supports single versions of a plugin
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

// availablePlugins returns all non-decommissioned plugins from the registry sorted by alphabetic order on `plugin.ID`
func (s *Service) availablePlugins(ctx context.Context) []*plugins.Plugin {
	ps := s.pluginRegistry.Plugins(ctx)

	res := make([]*plugins.Plugin, 0, len(ps))
	for _, p := range ps {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}
	sort.SliceStable(res, func(i, j int) bool {
		return res[i].ID < res[j].ID
	})
	return res
}

func (s *Service) Routes(ctx context.Context) []*plugins.StaticRoute {
	if err := s.AwaitRunning(ctx); err != nil {
		log.New(ServiceName).FromContext(ctx).Error("Failed to get routes", "error", err)
		return []*plugins.StaticRoute{}
	}
	staticRoutes := make([]*plugins.StaticRoute, 0)

	for _, p := range s.availablePlugins(ctx) {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}
	return staticRoutes
}

func (s *Service) shutdown(ctx context.Context) error {
	var errgroup errgroup.Group
	plugins := s.pluginRegistry.Plugins(ctx)
	for _, p := range plugins {
		plugin := p // capture loop variable
		errgroup.Go(func() error {
			plugin.Logger().Debug("Stopping plugin")
			if _, err := s.pluginLoader.Unload(ctx, plugin); err != nil {
				plugin.Logger().Error("Failed to stop plugin", "error", err)
				return err
			}
			plugin.Logger().Debug("Plugin stopped")
			return nil
		})
	}
	return errgroup.Wait()
}
