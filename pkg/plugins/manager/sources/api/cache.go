package api

import (
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/plugins/log"
)

// CacheManager defines the interface for cache management operations
type CacheManager interface {
	// Check verifies if a plugin is cached and valid
	Check(pluginID, desiredVersion string) (string, bool)
	// GetCachePath returns the cache path
	GetCachePath() string
}

// cacheManager handles plugin cache validation and management
type cacheManager struct {
	cachePath string
	log       log.Logger
}

// Ensure CacheManager implements CacheManagerInterface
var _ CacheManager = (*cacheManager)(nil)

// NewCacheManager creates a new cache manager
func NewCacheManager(cachePath string) CacheManager {
	return &cacheManager{
		cachePath: cachePath,
		log:       log.New("install.cache"),
	}
}

// GetCachePath returns the cache path
func (c *cacheManager) GetCachePath() string {
	return c.cachePath
}

// Check verifies if a plugin is cached and valid
func (c *cacheManager) Check(pluginID, desiredVersion string) (string, bool) {
	var pluginPath string

	cacheDirName := filepath.Join(pluginID + "-" + desiredVersion)
	versionedPath := filepath.Join(c.cachePath, cacheDirName)
	if _, err := os.Stat(versionedPath); err == nil {
		pluginPath = versionedPath
	} else {
		legacyPath := filepath.Join(c.cachePath, pluginID)
		if _, err := os.Stat(legacyPath); err == nil {
			pluginPath = legacyPath
		} else {
			return "", false
		}
	}

	return c.validatePluginJSON(pluginPath, pluginID, desiredVersion)
}

// validatePluginJSON validates the plugin.json file and returns the path if valid
func (c *cacheManager) validatePluginJSON(pluginPath, pluginID, desiredVersion string) (string, bool) {
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
