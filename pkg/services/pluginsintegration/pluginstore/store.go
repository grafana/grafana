package pluginstore

import (
	"context"
	"sort"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
)

var _ Store = (*Service)(nil)
var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore")

const ServiceName = "plugins.store"

// Store is the publicly accessible storage for plugins.
type Store interface {
	// Plugin finds a plugin by its ID.
	// Note: version is not required since Grafana only supports single versions of a plugin to avoid conflicts.
	Plugin(ctx context.Context, pluginID string) (Plugin, bool)
	// Plugins returns plugins by their requested type.
	Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin
}

type Service struct {
	services.NamedService

	pluginRegistry registry.Service
	pluginLoader   loader.Service
	pluginSources  sources.Registry
}

func ProvideService(pluginRegistry registry.Service, pluginSources sources.Registry,
	pluginLoader loader.Service) *Service {
	return New(pluginRegistry, pluginLoader, pluginSources)
}

func (s *Service) Run(ctx context.Context) error {
	if err := s.StartAsync(ctx); err != nil {
		return err
	}
	stopCtx := context.Background()
	return s.AwaitTerminated(stopCtx)
}

func NewPluginStoreForTest(pluginRegistry registry.Service, pluginLoader loader.Service, pluginSources sources.Registry) (*Service, error) {
	s := New(pluginRegistry, pluginLoader, pluginSources)
	if err := s.StartAsync(context.Background()); err != nil {
		return nil, err
	}
	if err := s.AwaitRunning(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func New(pluginRegistry registry.Service, pluginLoader loader.Service, pluginSources sources.Registry) *Service {
	s := &Service{
		pluginRegistry: pluginRegistry,
		pluginLoader:   pluginLoader,
		pluginSources:  pluginSources,
	}
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(ServiceName)
	return s
}

func (s *Service) starting(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "plugins.store.starting")
	defer span.End()

	start := time.Now()
	totalPlugins := 0
	logger := log.New(ServiceName)
	logger.Info("Loading plugins...")

	for _, ps := range s.pluginSources.List(ctx) {
		sourceClass := string(ps.PluginClass(ctx))
		span.AddEvent("loading plugin source", trace.WithAttributes(
			attribute.String("source.cladss", sourceClass),
		))

		loadedPlugins, err := s.pluginLoader.Load(ctx, ps)
		if err != nil {
			span.RecordError(err)
			span.SetAttributes(attribute.String("source.class", sourceClass))
			logger.Error("Loading plugin source failed", "source", ps.PluginClass(ctx), "error", err)
			return err
		}
		totalPlugins += len(loadedPlugins)

		span.AddEvent("plugin source loaded", trace.WithAttributes(
			attribute.String("source.class", sourceClass),
			attribute.Int("plugins.loaded", len(loadedPlugins)),
		))
	}

	duration := time.Since(start)
	span.SetAttributes(
		attribute.Int("total.plugins", totalPlugins),
		attribute.Int64("duration.ms", duration.Milliseconds()),
	)

	logger.Info("Plugins loaded", "count", totalPlugins, "duration", duration)

	return nil
}

func (s *Service) running(ctx context.Context) error {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	logger := log.New(ServiceName)

	for {
		select {
		case <-ticker.C:
			if err := s.reloadPlugins(ctx); err != nil {
				logger.Error("Periodic plugin reload failed", "error", err)
			}
		case <-ctx.Done():
			return nil
		}
	}
}

func (s *Service) stopping(failureReason error) error {
	return s.shutdown(context.Background())
}

func (s *Service) Plugin(ctx context.Context, pluginID string) (Plugin, bool) {
	ctx, span := tracer.Start(ctx, "plugins.store.plugin")
	defer span.End()

	span.SetAttributes(attribute.String("plugin.id", pluginID))

	if err := s.AwaitRunning(ctx); err != nil {
		span.RecordError(err)
		log.New(ServiceName).FromContext(ctx).Error("Failed to get plugin", "error", err)
		return Plugin{}, false
	}
	p, exists := s.plugin(ctx, pluginID)
	if !exists {
		span.SetAttributes(attribute.Bool("plugin.exists", false))
		return Plugin{}, false
	}

	span.SetAttributes(
		attribute.Bool("plugin.exists", true),
		attribute.String("plugin.type", string(p.Type)),
		attribute.String("plugin.version", p.Info.Version),
	)

	return ToGrafanaDTO(p), true
}

func (s *Service) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []Plugin {
	ctx, span := tracer.Start(ctx, "plugins.store.plugins")
	defer span.End()

	if err := s.AwaitRunning(ctx); err != nil {
		span.RecordError(err)
		log.New(ServiceName).FromContext(ctx).Error("Failed to get plugins", "error", err)
		return []Plugin{}
	}
	// if no types passed, assume all to provide comprehensive plugin listing
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	span.SetAttributes(attribute.Int("requested.types.count", len(pluginTypes)))
	for i, pt := range pluginTypes {
		span.SetAttributes(attribute.String("requested.type."+string(rune(i)), string(pt)))
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

	span.SetAttributes(attribute.Int("plugins.returned", len(pluginsList)))
	return pluginsList
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID, "") // version is not required since Grafana only supports single versions of a plugin to avoid conflicts
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
	ctx, span := tracer.Start(ctx, "plugins.store.routes")
	defer span.End()

	if err := s.AwaitRunning(ctx); err != nil {
		span.RecordError(err)
		log.New(ServiceName).FromContext(ctx).Error("Failed to get routes", "error", err)
		return []*plugins.StaticRoute{}
	}
	staticRoutes := make([]*plugins.StaticRoute, 0)

	for _, p := range s.availablePlugins(ctx) {
		if p.StaticRoute() != nil {
			staticRoutes = append(staticRoutes, p.StaticRoute())
		}
	}

	span.SetAttributes(attribute.Int("routes.count", len(staticRoutes)))
	return staticRoutes
}

// reloadPlugins checks all plugin sources for changes and reloads plugins if needed.
// This is called periodically to enable runtime plugin updates without restart.
func (s *Service) reloadPlugins(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "plugins.store.reload")
	defer span.End()

	logger := log.New(ServiceName)
	start := time.Now()

	// Discover plugins from all sources
	sourcesList := s.pluginSources.List(ctx)
	span.SetAttributes(attribute.Int("sources.count", len(sourcesList)))

	for _, ps := range sourcesList {
		sourceClass := string(ps.PluginClass(ctx))
		span.AddEvent("discovering plugins from source", trace.WithAttributes(
			attribute.String("source.class", sourceClass),
		))

		bundles, err := ps.Discover(ctx)
		if err != nil {
			span.RecordError(err)
			span.SetAttributes(attribute.String("source.class", sourceClass))
			logger.Error("Failed to discover plugins from source", "source", ps.PluginClass(ctx), "error", err)
			continue
		}

		span.AddEvent("plugins discovered from source", trace.WithAttributes(
			attribute.String("source.class", sourceClass),
			attribute.Int("bundles.discovered", len(bundles)),
		))

		for _, bundle := range bundles {
			pluginID := bundle.Primary.JSONData.ID
			bundleVersion := bundle.Primary.JSONData.Info.Version

			// Check if this plugin is already loaded
			existing, exists := s.pluginRegistry.Plugin(ctx, pluginID, "")
			if !exists {
				// New plugin discovered - load it
				span.AddEvent("new plugin discovered", trace.WithAttributes(
					attribute.String("plugin.id", pluginID),
					attribute.String("plugin.version", bundleVersion),
					attribute.String("source.class", sourceClass),
				))

				logger.Info("New plugin discovered, loading", "pluginId", pluginID, "version", bundleVersion)
				_, err := s.pluginLoader.Load(ctx, ps)
				if err != nil {
					span.RecordError(err)
					span.SetAttributes(
						attribute.String("plugin.id", pluginID),
						attribute.String("source.class", sourceClass),
					)
					logger.Error("Failed to load new plugin", "pluginId", pluginID, "error", err)
				}
				continue
			}

			// Check for version changes
			if existing.Info.Version != bundleVersion {
				span.AddEvent("plugin version change detected", trace.WithAttributes(
					attribute.String("plugin.id", pluginID),
					attribute.String("old.version", existing.Info.Version),
					attribute.String("new.version", bundleVersion),
					attribute.String("source.class", sourceClass),
				))

				logger.Info("Plugin version changed, reloading",
					"pluginId", pluginID,
					"oldVersion", existing.Info.Version,
					"newVersion", bundleVersion)

				// Unload old version
				unloadedPlugin, err := s.pluginLoader.Unload(ctx, existing)
				if err != nil {
					span.RecordError(err)
					span.SetAttributes(attribute.String("plugin.id", existing.ID))
					logger.Error("Failed to unload plugin", "pluginId", existing.ID, "error", err)
					continue
				}

				// Clean up old version directory if the filesystem supports it
				if unloadedPlugin != nil && unloadedPlugin.FS != nil {
					if remover, ok := unloadedPlugin.FS.(plugins.FSRemover); ok {
						if err := remover.Remove(); err != nil {
							span.AddEvent("cleanup failed", trace.WithAttributes(
								attribute.String("plugin.id", pluginID),
								attribute.String("old.version", existing.Info.Version),
							))
							logger.Warn("Failed to clean up old plugin version directory",
								"pluginId", pluginID,
								"oldVersion", existing.Info.Version,
								"error", err)
						} else {
							span.AddEvent("cleanup successful", trace.WithAttributes(
								attribute.String("plugin.id", pluginID),
								attribute.String("old.version", existing.Info.Version),
							))
							logger.Debug("Cleaned up old plugin version directory",
								"pluginId", pluginID,
								"oldVersion", existing.Info.Version)
						}
					}
				}

				// Load new version
				_, err = s.pluginLoader.Load(ctx, ps)
				if err != nil {
					span.RecordError(err)
					span.SetAttributes(attribute.String("plugin.id", pluginID))
					logger.Error("Failed to load updated plugin", "pluginId", pluginID, "error", err)
					continue
				}

				span.AddEvent("plugin reloaded successfully", trace.WithAttributes(
					attribute.String("plugin.id", pluginID),
					attribute.String("plugin.version", bundleVersion),
				))
				logger.Info("Plugin reloaded successfully", "pluginId", pluginID, "version", bundleVersion)
			}
		}
	}

	duration := time.Since(start)
	span.SetAttributes(attribute.Int64("duration.ms", duration.Milliseconds()))
	logger.Debug("Periodic plugin reload completed", "duration", duration)
	return nil
}

func (s *Service) shutdown(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "plugins.store.shutdown")
	defer span.End()

	var errgroup errgroup.Group
	plugins := s.pluginRegistry.Plugins(ctx)

	span.SetAttributes(attribute.Int("plugins.count", len(plugins)))

	// Unload all plugins concurrently to speed up shutdown
	for _, p := range plugins {
		plugin := p // capture loop variable to avoid closure issues
		errgroup.Go(func() error {
			plugin.Logger().Debug("Stopping plugin")
			if _, err := s.pluginLoader.Unload(ctx, plugin); err != nil {
				span.RecordError(err)
				span.SetAttributes(attribute.String("plugin.id", plugin.ID))
				plugin.Logger().Error("Failed to stop plugin", "error", err)
				return err
			}
			plugin.Logger().Debug("Plugin stopped")
			return nil
		})
	}

	err := errgroup.Wait()
	if err != nil {
		span.RecordError(err)
	}

	return err
}
