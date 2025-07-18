package pluginstore

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

var _ Store = (*Service)(nil)

// Store is the publicly accessible storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	// Note: version is not required since Grafana only supports single versions of a plugin.
	Plugin(ctx context.Context, pluginID string) (Plugin, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin
}

type Service struct {
	pluginRegistry registry.Service
	pluginLoader   loader.Service
	pluginSources  sources.Registry

	log     log.Logger
	readyCh chan struct{}
}

func ProvideService(pluginRegistry registry.Service, pluginSources sources.Registry,
	pluginLoader loader.Service) (*Service, error) {
	return New(pluginRegistry, pluginLoader, pluginSources), nil
}

func New(pluginRegistry registry.Service, pluginLoader loader.Service,
	pluginSources sources.Registry) *Service {
	return &Service{
		pluginRegistry: pluginRegistry,
		pluginLoader:   pluginLoader,
		pluginSources:  pluginSources,
		readyCh:        make(chan struct{}),
		log:            log.New("plugin.store"),
	}
}

func (s *Service) Run(ctx context.Context) error {
	if err := s.loadPlugins(ctx); err != nil {
		return err
	}
	<-ctx.Done()
	s.shutdown(ctx)
	return ctx.Err()
}

func (s *Service) Plugin(ctx context.Context, pluginID string) (Plugin, bool) {
	if err := s.awaitReadyOrTimeout(ctx); err != nil {
		return Plugin{}, false
	}

	p, exists := s.plugin(ctx, pluginID)
	if !exists {
		return Plugin{}, false
	}

	return ToGrafanaDTO(p), true
}

func (s *Service) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin {
	if err := s.awaitReadyOrTimeout(ctx); err != nil {
		return nil
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

func (s *Service) awaitReadyOrTimeout(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-s.readyCh:
		return nil
	}
}

func (s *Service) Routes(ctx context.Context) []*plugins.StaticRoute {
	staticRoutes := make([]*plugins.StaticRoute, 0)

	if err := s.awaitReadyOrTimeout(ctx); err != nil {
		return staticRoutes
	}

	for _, p := range s.availablePlugins(ctx) {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}
	return staticRoutes
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

func (s *Service) shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	// TODO figure out reliable shutdown when experiencing "apiserver is shutting down" error
	// Shutdown() on Registry
	for _, plugin := range s.pluginRegistry.Plugins(context.WithoutCancel(ctx)) {
		wg.Add(1)
		go func(ctx context.Context, p *plugins.Plugin) {
			defer wg.Done()
			p.Logger().Debug("Stopping plugin")
			if _, err := s.pluginLoader.Unload(ctx, p); err != nil {
				p.Logger().Error("Failed to stop plugin", "error", err)
			}
			p.Logger().Debug("Plugin stopped")
		}(ctx, plugin)
	}
	wg.Wait()
}

func (s *Service) loadPlugins(ctx context.Context) error {
	start := time.Now()
	totalPlugins := 0
	s.log.Info("Loading plugins...")

	for _, ps := range s.pluginSources.List(ctx) {
		loadedPlugins, err := s.pluginLoader.Load(ctx, ps)
		if err != nil {
			s.log.Error("Loading plugin source failed", "source", ps.PluginClass(ctx), "error", err)
			return err
		}

		totalPlugins += len(loadedPlugins)
	}

	s.log.Info("Plugins loaded", "count", totalPlugins, "duration", time.Since(start))
	close(s.readyCh)
	return nil
}
