package pluginstore

import (
	"context"
	"sort"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

var _ Store = (*Service)(nil)

// Store is the publicly accessible storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	Plugin(ctx context.Context, pluginID string) (Plugin, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin
}

type Service struct {
	pluginRegistry registry.Service
	pluginLoader   loader.Service
}

func ProvideService(pluginRegistry registry.Service, pluginSources sources.Registry,
	pluginLoader loader.Service) (*Service, error) {
	ctx := context.Background()
	for _, ps := range pluginSources.List(ctx) {
		if _, err := pluginLoader.Load(ctx, ps); err != nil {
			return nil, err
		}
	}
	return New(pluginRegistry, pluginLoader), nil
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	s.shutdown(ctx)
	return ctx.Err()
}

func New(pluginRegistry registry.Service, pluginLoader loader.Service) *Service {
	return &Service{
		pluginRegistry: pluginRegistry,
		pluginLoader:   pluginLoader,
	}
}

func (s *Service) Plugin(ctx context.Context, pluginID string) (Plugin, bool) {
	p, exists := s.plugin(ctx, pluginID)
	if !exists {
		return Plugin{}, false
	}

	return ToGrafanaDTO(p), true
}

func (s *Service) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin {
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

func (s *Service) Renderer(ctx context.Context) *plugins.Plugin {
	for _, p := range s.availablePlugins(ctx) {
		if p.IsRenderer() {
			return p
		}
	}
	return nil
}

func (s *Service) SecretsManager(ctx context.Context) *plugins.Plugin {
	for _, p := range s.availablePlugins(ctx) {
		if p.IsSecretsManager() {
			return p
		}
	}
	return nil
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID)
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
	staticRoutes := make([]*plugins.StaticRoute, 0)

	for _, p := range s.availablePlugins(ctx) {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}
	return staticRoutes
}

func (s *Service) shutdown(ctx context.Context) {
	var wg sync.WaitGroup
	for _, plugin := range s.pluginRegistry.Plugins(ctx) {
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
