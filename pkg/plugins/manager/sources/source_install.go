package sources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type InstallSource struct {
	pluginsToInstall []setting.InstallPlugin
	downloader       PluginDownloader
	cachePath        string
	buildVersion     string
	log              log.Logger
	pluginClass      plugins.Class // Determined from the plugins in this source
}

// NewInstallSource creates a source for installing plugins.
// This works for both config-based and API-based plugin installations.
func NewInstallSource(
	pluginsToInstall []setting.InstallPlugin,
	downloader PluginDownloader,
	cachePath string,
	cfgProvider configprovider.ConfigProvider,
	buildVersion string,
) *InstallSource {
	// Determine plugin class based on the plugins in this source
	pluginClass := plugins.ClassExternal // Default to external
	if len(pluginsToInstall) > 0 {
		// If all plugins have the same class, use that class
		firstClass := pluginsToInstall[0].Class
		allSameClass := true
		for _, plugin := range pluginsToInstall {
			if plugin.Class != firstClass {
				allSameClass = false
				break
			}
		}
		if allSameClass && firstClass == "core" {
			pluginClass = plugins.ClassCore
		}
	}

	return &InstallSource{
		pluginsToInstall: pluginsToInstall,
		downloader:       downloader,
		cachePath:        cachePath,
		buildVersion:     buildVersion,
		pluginClass:      pluginClass,
		log:              log.New("install.source"),
	}
}

// PluginClass returns the plugin class for this source
func (s *InstallSource) PluginClass(_ context.Context) plugins.Class {
	return s.pluginClass
}

// DefaultSignature returns the default signature for installed plugins
func (s *InstallSource) DefaultSignature(_ context.Context, _ string) (plugins.Signature, bool) {
	return plugins.Signature{}, false
}

// Discover downloads declared plugins (if not cached) and returns FoundBundles.
func (s *InstallSource) Discover(ctx context.Context) ([]*plugins.FoundBundle, error) {
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
	localSource := NewLocalSource(plugins.ClassExternal, pluginPaths)
	bundles, err := localSource.Discover(ctx)
	if err != nil {
		return nil, tracing.Errorf(span, "failed to discover plugins from local source: %w", err)
	}

	span.SetStatus(codes.Ok, fmt.Sprintf("successfully discovered %d plugins", len(bundles)))
	return bundles, nil
}

// ensurePlugin ensures a plugin is available in cache, downloading if necessary.
func (s *InstallSource) ensurePlugin(ctx context.Context, installPlugin setting.InstallPlugin) (string, error) {
	if installPlugin.Version == "" {
		cacheKey := s.getVersionCacheKey(installPlugin.ID, installPlugin.URL)
		if cachedVersion, ok := versionCache.Load(cacheKey); ok {
			i := installPlugin
			i.Version = cachedVersion.(string)
			return s.ensurePlugin(ctx, i)
		}
		return s.downloadAndResolveVersion(ctx, installPlugin)
	}
	path, cached := s.checkCache(installPlugin.ID, installPlugin.Version)
	if cached {
		return path, nil
	}
	return s.downloadWithVersion(ctx, installPlugin)
}

// downloadAndResolveVersion downloads a plugin to a temp directory, reads the version,
// and moves it to the versioned cache directory.
func (s *InstallSource) downloadAndResolveVersion(ctx context.Context, installPlugin setting.InstallPlugin) (string, error) {
	tempDir := fmt.Sprintf(".tmp_%s_%d", installPlugin.ID, time.Now().UnixNano())

	err := s.downloadToDir(ctx, installPlugin, tempDir)
	if err != nil {
		var dupeErr plugins.DuplicateError
		if errors.As(err, &dupeErr) {
			// Don't store empty version in cache - let the other goroutine handle the version resolution
			os.RemoveAll(filepath.Join(s.cachePath, tempDir))
			return "", err
		}
		os.RemoveAll(filepath.Join(s.cachePath, tempDir))
		return "", err
	}

	pluginJSONPath := filepath.Join(s.cachePath, tempDir, "plugin.json")
	data, err := os.ReadFile(pluginJSONPath)
	if err != nil {
		os.RemoveAll(filepath.Join(s.cachePath, tempDir))
		return "", err
	}

	var jsonData struct {
		Info struct {
			Version string `json:"version"`
		} `json:"info"`
	}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		os.RemoveAll(filepath.Join(s.cachePath, tempDir))
		return "", err
	}

	resolvedVersion := jsonData.Info.Version
	cacheKey := s.getVersionCacheKey(installPlugin.ID, installPlugin.URL)
	versionCache.Store(cacheKey, resolvedVersion)

	versionedDir := fmt.Sprintf("%s-%s", installPlugin.ID, resolvedVersion)
	fullVersionedPath := filepath.Join(s.cachePath, versionedDir)
	if _, err := os.Stat(fullVersionedPath); err == nil {
		// remove temp dir if the versioned path exists
		os.RemoveAll(filepath.Join(s.cachePath, tempDir))
		return fullVersionedPath, nil
	}

	tempFullPath := filepath.Join(s.cachePath, tempDir)
	if err := os.Rename(tempFullPath, fullVersionedPath); err != nil {
		os.RemoveAll(tempFullPath)
		return "", err
	}

	return fullVersionedPath, nil
}

// getVersionCacheKey creates a cache key that includes the plugin ID and URL (if set)
func (s *InstallSource) getVersionCacheKey(pluginID, url string) string {
	if url != "" {
		return fmt.Sprintf("%s:%s", pluginID, url)
	}
	return pluginID
}

// downloadWithVersion downloads a plugin with a known version to the versioned cache directory.
func (s *InstallSource) downloadWithVersion(ctx context.Context, installPlugin setting.InstallPlugin) (string, error) {
	versionedDir := fmt.Sprintf("%s-%s", installPlugin.ID, installPlugin.Version)
	err := s.downloadToDir(ctx, installPlugin, versionedDir)
	if err != nil {
		return "", err
	}
	return filepath.Join(s.cachePath, versionedDir), nil
}

func (s *InstallSource) downloadToDir(ctx context.Context, installPlugin setting.InstallPlugin, targetDir string) error {
	ctx, span := tracer.Start(ctx, "InstallSource.downloadToDir")
	defer span.End()

	span.SetAttributes(
		attribute.String("plugin.id", installPlugin.ID),
		attribute.String("plugin.version", installPlugin.Version),
		attribute.String("plugin.target_dir", targetDir),
	)

	start := time.Now()
	ctx = repo.WithRequestOrigin(ctx, "install")

	opts := plugins.NewAddOpts(s.buildVersion, runtime.GOOS, runtime.GOARCH, installPlugin.URL)
	dirFunc := func(pluginID string) string {
		return targetDir
	}
	opts = opts.WithCustomDirNameFunc(dirFunc)
	archive, err := s.downloader.Download(ctx, installPlugin.ID, installPlugin.Version, opts)
	if err != nil {
		var dupeErr plugins.DuplicateError
		if errors.As(err, &dupeErr) {
			// Another goroutine is downloading, skip to avoid duplicate downloads
			span.AddEvent("plugin download already in progress", trace.WithAttributes(attribute.String("plugin.id", installPlugin.ID)))
			return plugins.DuplicateError{PluginID: installPlugin.ID}
		}
		s.log.Error("Download failed", "pluginId", installPlugin.ID, "version", installPlugin.Version, "error", err)
		return tracing.Errorf(span, "download failed: %w", err)
	}

	if archive == nil {
		return tracing.Errorf(span, "downloader returned nil archive")
	}

	span.AddEvent("download completed", trace.WithAttributes(
		attribute.String("plugin.id", installPlugin.ID),
		attribute.String("plugin.version", archive.Version),
		attribute.String("plugin.archive_path", archive.Path),
	))

	// handle dependencies recursively to ensure all required plugins are available
	for _, dep := range archive.Dependencies {
		span.AddEvent("ensuring plugin dependency", trace.WithAttributes(
			attribute.String("plugin.id", installPlugin.ID),
			attribute.String("dependency.id", dep.ID),
		))
		depPlugin := setting.InstallPlugin{
			ID:      dep.ID,
			Version: "",
			URL:     "",
		}

		_, err := s.ensurePlugin(ctx, depPlugin)
		if err != nil {
			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				span.AddEvent("dependency already available", trace.WithAttributes(attribute.String("dependency.id", dep.ID)))
				continue
			}
			return tracing.Errorf(span, "failed to ensure dependency %s: %w", dep.ID, err)
		}
	}

	span.SetStatus(codes.Ok, "plugin downloaded successfully")
	elapsed := time.Since(start)
	installRequestDuration.WithLabelValues(installPlugin.ID, archive.Version).Observe(elapsed.Seconds())
	installRequestCounter.WithLabelValues(installPlugin.ID, archive.Version).Inc()

	return nil
}

// checkCache checks if a plugin is already downloaded to the cache directory.
func (s *InstallSource) checkCache(pluginID, desiredVersion string) (string, bool) {
	var pluginPath string

	cacheDirName := fmt.Sprintf("%s-%s", pluginID, desiredVersion)
	versionedPath := filepath.Join(s.cachePath, cacheDirName)
	if _, err := os.Stat(versionedPath); err == nil {
		pluginPath = versionedPath
	} else {
		legacyPath := filepath.Join(s.cachePath, pluginID)
		if _, err := os.Stat(legacyPath); err == nil {
			pluginPath = legacyPath
		} else {
			return "", false
		}
	}

	pluginJSONPath := filepath.Join(pluginPath, "plugin.json")
	data, err := os.ReadFile(pluginJSONPath)
	if err != nil {
		return "", false
	}

	var jsonData struct {
		ID   string `json:"id"`
		Info struct {
			Version string `json:"version"`
		} `json:"info"`
	}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return "", false
	}

	if jsonData.ID != pluginID {
		return "", false
	}

	cachedVersion := jsonData.Info.Version
	if cachedVersion == desiredVersion {
		return pluginPath, true
	}

	return "", false
}
