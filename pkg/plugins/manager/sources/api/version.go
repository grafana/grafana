package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana/apps/plugins/pkg/app/install"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// versionCache stores resolved plugin versions
var versionCache sync.Map

// VersionResolver defines the interface for version resolution operations
type VersionResolver interface {
	// ResolveAndDownload downloads a plugin to a temp directory, reads the version, and moves it to the versioned cache directory
	ResolveAndDownload(ctx context.Context, installPlugin install.PluginInstall) (string, error)
	// GetVersionCacheKey returns the cache key for version resolution
	GetVersionCacheKey(pluginID, url string) string
}

// versionResolver handles version resolution and caching
type versionResolver struct {
	cacheManager CacheManager
	orchestrator InstallOrchestrator
	log          log.Logger
}

// Ensure VersionResolver implements VersionResolverInterface
var _ VersionResolver = (*versionResolver)(nil)

// NewVersionResolver creates a new version resolver
func NewVersionResolver(cacheManager CacheManager, orchestrator InstallOrchestrator) *versionResolver {
	return &versionResolver{
		cacheManager: cacheManager,
		orchestrator: orchestrator,
		log:          log.New("install.version"),
	}
}

// ResolveAndDownload downloads a plugin to a temp directory, reads the version,
// and moves it to the versioned cache directory.
func (v *versionResolver) ResolveAndDownload(ctx context.Context, installPlugin install.PluginInstall) (string, error) {
	tempDir := fmt.Sprintf(".tmp_%s_%d", installPlugin.ID, time.Now().UnixNano())

	err := v.orchestrator.DownloadToDir(ctx, installPlugin, tempDir)
	if err != nil {
		var dupeErr plugins.DuplicateError
		if errors.As(err, &dupeErr) {
			// Don't store empty version in cache - let the other goroutine handle the version resolution
			if err := os.RemoveAll(filepath.Join(v.cacheManager.GetCachePath(), tempDir)); err != nil {
				v.log.Error("Failed to remove temp directory", "error", err)
			}
			return "", err
		}
		if err := os.RemoveAll(filepath.Join(v.cacheManager.GetCachePath(), tempDir)); err != nil {
			return "", err
		}
		return "", err
	}

	pluginJSONPath := filepath.Join(v.cacheManager.GetCachePath(), tempDir, "plugin.json")
	data, err := os.ReadFile(pluginJSONPath)
	if err != nil {
		if err := os.RemoveAll(filepath.Join(v.cacheManager.GetCachePath(), tempDir)); err != nil {
			v.log.Error("Failed to remove temp directory", "error", err)
		}
		return "", err
	}

	var jsonData struct {
		Info struct {
			Version string `json:"version"`
		} `json:"info"`
	}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		os.RemoveAll(filepath.Join(v.cacheManager.GetCachePath(), tempDir))
		return "", err
	}

	resolvedVersion := jsonData.Info.Version
	cacheKey := v.getVersionCacheKey(installPlugin.ID, installPlugin.URL)
	versionCache.Store(cacheKey, resolvedVersion)

	versionedDir := fmt.Sprintf("%s-%s", installPlugin.ID, resolvedVersion)
	fullVersionedPath := filepath.Join(v.cacheManager.GetCachePath(), versionedDir)
	if _, err := os.Stat(fullVersionedPath); err == nil {
		// remove temp dir if the versioned path exists
		os.RemoveAll(filepath.Join(v.cacheManager.GetCachePath(), tempDir))
		return fullVersionedPath, nil
	}

	tempFullPath := filepath.Join(v.cacheManager.GetCachePath(), tempDir)
	if err := os.Rename(tempFullPath, fullVersionedPath); err != nil {
		os.RemoveAll(tempFullPath)
		return "", err
	}

	return fullVersionedPath, nil
}

// GetVersionCacheKey returns the cache key for version resolution
func (v *versionResolver) GetVersionCacheKey(pluginID, url string) string {
	return v.getVersionCacheKey(pluginID, url)
}

// getVersionCacheKey creates a cache key that includes the plugin ID and URL (if set)
func (v *versionResolver) getVersionCacheKey(pluginID, url string) string {
	if url != "" {
		return fmt.Sprintf("%s:%s", pluginID, url)
	}
	return pluginID
}
