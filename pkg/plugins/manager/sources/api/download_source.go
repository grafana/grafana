package api

import (
	"context"
	"errors"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// DownloadSource handles plugin installation from various sources
type DownloadSource struct {
	pluginsToInstall   []install.PluginInstall
	cacheManager       CacheManager
	versionResolver    VersionResolver
	orchestrator       InstallOrchestrator
	pluginClass        plugins.Class
	localSourceBuilder localSourceBuilder
	log                log.Logger
}

type localSourceBuilder func(class plugins.Class, paths []string) (plugins.PluginSource, error)

// NewDownloadSource creates a source for installing external plugins.
// This works for both config-based and API-based plugin installations.
func NewDownloadSource(
	pluginsToInstall []install.PluginInstall,
	cacheManager CacheManager,
	orchestrator InstallOrchestrator,
	versionResolver VersionResolver,
	localSourceBuilder localSourceBuilder,
) *DownloadSource {
	return &DownloadSource{
		pluginsToInstall:   pluginsToInstall,
		cacheManager:       cacheManager,
		versionResolver:    versionResolver,
		orchestrator:       orchestrator,
		localSourceBuilder: localSourceBuilder,
		log:                log.New("install.source"),
	}
}

// PluginClass returns the plugin class for this source
func (s *DownloadSource) PluginClass(_ context.Context) plugins.Class {
	return plugins.ClassExternal
}

// DefaultSignature returns the default signature for installed plugins
func (s *DownloadSource) DefaultSignature(_ context.Context, _ string) (plugins.Signature, bool) {
	return plugins.Signature{}, false
}

// Discover downloads declared plugins (if not cached) and returns FoundBundles.
func (s *DownloadSource) Discover(ctx context.Context) ([]*plugins.FoundBundle, error) {
	ctx, span := tracer.Start(ctx, "InstallSource.Discover")
	defer span.End()
	logger := s.log.FromContext(ctx)
	logger.Debug("Discovering plugins", "plugins", s.pluginsToInstall, "traceID", span.SpanContext().TraceID())

	if len(s.pluginsToInstall) == 0 {
		return []*plugins.FoundBundle{}, nil
	}

	span.SetAttributes(
		attribute.Int("plugins.count", len(s.pluginsToInstall)),
	)

	pluginPaths := make([]string, 0, len(s.pluginsToInstall))

	for _, installPlugin := range s.pluginsToInstall {
		path, err := s.ensurePlugin(ctx, installPlugin)
		if err != nil {
			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				span.AddEvent("plugin download already in progress, skipping", trace.WithAttributes(attribute.String("plugin.id", installPlugin.ID)))
				continue
			}
			span.AddEvent("plugin ensure failed, continuing", trace.WithAttributes(
				attribute.String("plugin.id", installPlugin.ID),
				attribute.String("error", err.Error()),
			))
			s.log.Error("Failed to ensure plugin", "pluginId", installPlugin.ID, "error", err)
			continue
		}

		if path != "" {
			pluginPaths = append(pluginPaths, path)
		}
	}

	if len(pluginPaths) == 0 {
		span.SetStatus(codes.Ok, "plugins already downloaded")
		return []*plugins.FoundBundle{}, nil
	}

	// rely on LocalSource to discover the plugins at the paths we've downloaded to
	localSource, err := s.localSourceBuilder(plugins.ClassExternal, pluginPaths)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to build local source: %w", err)
	}

	bundles, err := localSource.Discover(ctx)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to discover plugins from local source: %w", err)
	}

	span.SetStatus(codes.Ok, fmt.Sprintf("successfully discovered %d plugins", len(bundles)))
	return bundles, nil
}

// SetPluginsToInstall updates the list of plugins to install
func (s *DownloadSource) SetPluginsToInstall(pluginsToInstall []install.PluginInstall) {
	s.pluginsToInstall = pluginsToInstall
}

// ensurePlugin ensures a plugin is available in cache, downloading if necessary.
func (s *DownloadSource) ensurePlugin(ctx context.Context, installPlugin install.PluginInstall) (string, error) {
	if installPlugin.Version == "" {
		cacheKey := s.versionResolver.GetVersionCacheKey(installPlugin.ID, installPlugin.URL)
		if cachedVersion, ok := versionCache.Load(cacheKey); ok {
			i := installPlugin
			i.Version = cachedVersion.(string)
			return s.ensurePlugin(ctx, i)
		}
		return s.versionResolver.ResolveAndDownload(ctx, installPlugin)
	}
	path, cached := s.cacheManager.Check(installPlugin.ID, installPlugin.Version)
	if cached {
		return path, nil
	}
	return s.orchestrator.DownloadWithVersion(ctx, installPlugin)
}
