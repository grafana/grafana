package sources

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/storage"
	"github.com/grafana/grafana/pkg/setting"
)

// mockDownloader is a test implementation of PluginDownloader
type mockDownloader struct {
	downloadFunc func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error)
}

// mockConfigProvider is a test implementation of configprovider.ConfigProvider
type mockConfigProvider struct {
	pCfg           *config.PluginManagementCfg
	staticRootPath string
}

func (m *mockConfigProvider) Get(ctx context.Context) (*setting.Cfg, error) {
	// Use configprovider.ConfigProvider interface to satisfy the linter
	var _ configprovider.ConfigProvider = m
	return &setting.Cfg{
		PreinstallPluginsSync:  []setting.InstallPlugin{},
		PreinstallPluginsAsync: []setting.InstallPlugin{},
		PluginsPath:            m.pCfg.PluginsPath,
		BuildVersion:           "10.0.0",
		PluginSettings:         m.pCfg.PluginSettings,
		StaticRootPath:         m.staticRootPath,
	}, nil
}

func (m *mockDownloader) Download(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
	if m.downloadFunc != nil {
		return m.downloadFunc(ctx, pluginID, version, opts)
	}
	return &storage.ExtractedPluginArchive{
		ID:      pluginID,
		Version: version,
		Path:    filepath.Join("/tmp/plugins", pluginID),
	}, nil
}

// createMockDownloaderWithDirFunc creates a mock downloader that respects the target directory function
func createMockDownloaderWithDirFunc(tmpDir string, createPluginJSON func(pluginID, targetDir string) error) *mockDownloader {
	return &mockDownloader{
		downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
			// Use the custom dir function from opts to get the target directory
			// This is how the real download process determines where to put the plugin
			customDirFunc := opts.CustomDirNameFunc()
			var targetDir string
			if customDirFunc != nil {
				targetDir = customDirFunc(pluginID)
			} else {
				// Fallback to default naming
				targetDir = pluginID + "-" + version
				if version == "" {
					targetDir = pluginID + "-1.0.0"
				}
			}

			// Create the plugin directory and JSON file
			pluginDir := filepath.Join(tmpDir, targetDir)
			if err := createPluginJSON(pluginID, pluginDir); err != nil {
				// If createPluginJSON returns an error, return it as the download error
				return nil, err
			}

			archive := &storage.ExtractedPluginArchive{
				ID:      pluginID,
				Version: version,
				Path:    pluginDir,
			}

			// Add dependencies for parent plugin
			if pluginID == "parent-plugin" {
				archive.Dependencies = []*storage.Dependency{
					{ID: "dep-plugin"},
				}
			}

			return archive, nil
		},
	}
}

func TestPreinstallSource_CheckCache(t *testing.T) {
	t.Run("Plugin not cached", func(t *testing.T) {
		tmpDir := t.TempDir()
		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Plugin cached with matching version", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json
		pluginJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.True(t, cached)
		require.Equal(t, pluginDir, path)
	})

	t.Run("Plugin cached with different version", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json with v1.0.0
		pluginJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "2.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// Request v2.0.0 but cache has v1.0.0
		path, cached := source.checkCache("test-plugin", "2.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Plugin cached with no version constraint", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json
		pluginJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: ""}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// With no version specified, checkCache should not find it (it will go through downloadAndResolveVersion)
		path, cached := source.checkCache("test-plugin", "")
		require.False(t, cached)
		require.Empty(t, path)
	})
}

func TestPreinstallSource_Discover_Sync(t *testing.T) {
	t.Run("Returns error on download failure in sync mode", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadCalled := false

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadCalled = true
				return nil, plugins.ErrPluginNotInstalled
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.Error(t, err)
		require.Nil(t, bundles)
		require.True(t, downloadCalled)
	})

	t.Run("Uses cached plugin if available", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json
		pluginJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"type": "datasource",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		downloadCalled := false
		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadCalled = true
				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    filepath.Join("/tmp/plugins", pluginID),
				}, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.NotNil(t, bundles)
		require.False(t, downloadCalled, "Should use cache, not download")
		require.Len(t, bundles, 1)
		require.Equal(t, "test-plugin", bundles[0].Primary.JSONData.ID)
	})
}

func TestPreinstallSource_Discover_Async(t *testing.T) {
	t.Run("Logs error but continues on download failure in async mode", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "good-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json for good plugin
		pluginJSON := map[string]interface{}{
			"id":   "good-plugin",
			"name": "Good Plugin",
			"type": "datasource",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				if pluginID == "bad-plugin" {
					return nil, plugins.ErrPluginNotInstalled
				}
				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    filepath.Join(tmpDir, pluginID),
				}, nil
			},
		}

		source := NewPreinstallAsyncSource(
			[]setting.InstallPlugin{
				{ID: "bad-plugin", Version: "1.0.0"},
				{ID: "good-plugin", Version: "1.0.0"},
			},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.NoError(t, err, "Async mode should not return error")
		require.NotNil(t, bundles)
		// Should have the good plugin only
		require.Len(t, bundles, 1)
		require.Equal(t, "good-plugin", bundles[0].Primary.JSONData.ID)
	})
}

func TestPreinstallSource_Dependencies(t *testing.T) {
	t.Run("Downloads dependencies recursively", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadedPlugins := []string{}

		downloader := createMockDownloaderWithDirFunc(tmpDir, func(pluginID, pluginDir string) error {
			downloadedPlugins = append(downloadedPlugins, pluginID)
			require.NoError(t, os.MkdirAll(pluginDir, 0755))
			pluginJSON := map[string]interface{}{
				"id":   pluginID,
				"name": pluginID,
				"type": "datasource",
				"info": map[string]string{
					"version": "1.0.0",
				},
			}
			data, _ := json.Marshal(pluginJSON)
			return os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644)
		})

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "parent-plugin", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.NotNil(t, bundles)

		// Should have downloaded both parent and dependency
		require.Contains(t, downloadedPlugins, "parent-plugin")
		require.Contains(t, downloadedPlugins, "dep-plugin")
	})

	t.Run("Handles DuplicateError for already downloading dependency", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadAttempts := 0

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadAttempts++

				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					// Fallback to default naming
					targetDir = pluginID + "-" + version
					if version == "" {
						targetDir = pluginID + "-1.0.0"
					}
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": "1.0.0",
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				// Check if this should return DuplicateError (second attempt for dep-plugin)
				if pluginID == "dep-plugin" && downloadAttempts > 1 {
					// Second attempt to download dependency returns DuplicateError
					return nil, plugins.DuplicateError{PluginID: pluginID}
				}

				archive := &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}

				// Add dependencies for parent plugin
				if pluginID == "parent-plugin" {
					archive.Dependencies = []*storage.Dependency{
						{ID: "dep-plugin"},
					}
				}

				return archive, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{
				{ID: "parent-plugin", Version: "1.0.0"},
			},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// Should not error even though dependency returns DuplicateError
		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.NotNil(t, bundles)
	})
}

func TestPreinstallSource_PluginClass(t *testing.T) {
	source := NewPreinstallSyncSource(
		[]setting.InstallPlugin{},
		&mockDownloader{},
		"/tmp",
		&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: "/tmp"}},
		"10.0.0",
	)

	require.Equal(t, plugins.ClassExternal, source.PluginClass(context.Background()))
}

func TestPreinstallSource_DefaultSignature(t *testing.T) {
	source := NewPreinstallSyncSource(
		[]setting.InstallPlugin{},
		&mockDownloader{},
		"/tmp",
		&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: "/tmp"}},
		"10.0.0",
	)

	sig, exists := source.DefaultSignature(context.Background(), "test-plugin")
	require.False(t, exists)
	require.Equal(t, plugins.Signature{}, sig)
}

func TestPreinstallSource_CheckCache_EdgeCases(t *testing.T) {
	t.Run("Corrupted plugin.json in cache", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create corrupted plugin.json
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte("invalid json content"), 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Missing plugin.json in cache directory", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))
		// Don't create plugin.json

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Plugin.json with missing version field", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json without version field
		pluginJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				// Missing version field
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Plugin.json with missing ID field", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json without ID field
		pluginJSON := map[string]interface{}{
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Multiple versions of same plugin in cache", func(t *testing.T) {
		tmpDir := t.TempDir()

		// Create multiple versions
		pluginDir1 := filepath.Join(tmpDir, "test-plugin-1.0.0")
		pluginDir2 := filepath.Join(tmpDir, "test-plugin-2.0.0")
		require.NoError(t, os.MkdirAll(pluginDir1, 0755))
		require.NoError(t, os.MkdirAll(pluginDir2, 0755))

		// Create plugin.json for v1.0.0
		pluginJSON1 := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data1, _ := json.Marshal(pluginJSON1)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir1, "plugin.json"), data1, 0644))

		// Create plugin.json for v2.0.0
		pluginJSON2 := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "2.0.0",
			},
		}
		data2, _ := json.Marshal(pluginJSON2)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir2, "plugin.json"), data2, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// Should find v1.0.0
		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.True(t, cached)
		require.Equal(t, pluginDir1, path)

		// Should find v2.0.0
		path, cached = source.checkCache("test-plugin", "2.0.0")
		require.True(t, cached)
		require.Equal(t, pluginDir2, path)

		// With no version constraint, checkCache should not find it (it will go through downloadAndResolveVersion)
		path, cached = source.checkCache("test-plugin", "")
		require.False(t, cached)
		require.Empty(t, path)
	})
}

func TestPreinstallSource_BackwardsCompatibility(t *testing.T) {
	t.Run("Old directory structure without version suffix", func(t *testing.T) {
		tmpDir := t.TempDir()
		// Create old-style directory (just plugin ID, no version suffix)
		pluginDir := filepath.Join(tmpDir, "test-plugin")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json
		pluginJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: ""}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// Should find it with new versioned directory structure
		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.True(t, cached)
		require.Equal(t, pluginDir, path)

		// With empty version constraint, checkCache should not find it (it will go through downloadAndResolveVersion)
		path, cached = source.checkCache("test-plugin", "")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Old plugin.json format with version at root level", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(pluginDir, 0755))

		// Create plugin.json with old format (version at root level)
		pluginJSON := map[string]interface{}{
			"id":      "test-plugin",
			"name":    "Test Plugin",
			"version": "1.0.0", // Old format: version at root level
		}
		data, _ := json.Marshal(pluginJSON)
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// Should not find it because we expect version in info.version
		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.False(t, cached)
		require.Empty(t, path)
	})

	t.Run("Prioritizes versioned directories over legacy directories", func(t *testing.T) {
		tmpDir := t.TempDir()

		// Create both legacy and versioned directories
		legacyDir := filepath.Join(tmpDir, "test-plugin")
		versionedDir := filepath.Join(tmpDir, "test-plugin-1.0.0")
		require.NoError(t, os.MkdirAll(legacyDir, 0755))
		require.NoError(t, os.MkdirAll(versionedDir, 0755))

		// Create plugin.json for legacy directory
		legacyJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin Legacy",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ := json.Marshal(legacyJSON)
		require.NoError(t, os.WriteFile(filepath.Join(legacyDir, "plugin.json"), data, 0644))

		// Create plugin.json for versioned directory
		versionedJSON := map[string]interface{}{
			"id":   "test-plugin",
			"name": "Test Plugin Versioned",
			"info": map[string]string{
				"version": "1.0.0",
			},
		}
		data, _ = json.Marshal(versionedJSON)
		require.NoError(t, os.WriteFile(filepath.Join(versionedDir, "plugin.json"), data, 0644))

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			&mockDownloader{},
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// Should find the versioned directory (prioritized over legacy)
		path, cached := source.checkCache("test-plugin", "1.0.0")
		require.True(t, cached)
		require.Equal(t, versionedDir, path)

		// With no version constraint, checkCache should not find it (it will go through downloadAndResolveVersion)
		path, cached = source.checkCache("test-plugin", "")
		require.False(t, cached)
		require.Empty(t, path)
	})
}

func TestPreinstallSource_DownloadEdgeCases(t *testing.T) {
	t.Run("Downloader returns nil archive without error", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				return nil, nil // Return nil archive, nil error
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "downloader returned nil archive")
		require.Nil(t, bundles)
	})

	t.Run("Download failure during dependency resolution", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				if pluginID == "dep-plugin" {
					return nil, plugins.ErrPluginNotInstalled
				}

				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
					if version == "" {
						targetDir = pluginID + "-1.0.0"
					}
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": "1.0.0",
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				archive := &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}

				// Add dependencies for parent plugin
				if pluginID == "parent-plugin" {
					archive.Dependencies = []*storage.Dependency{
						{ID: "dep-plugin"},
					}
				}

				return archive, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "parent-plugin", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to ensure dependency dep-plugin")
		require.Nil(t, bundles)
	})

	t.Run("Circular dependencies", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadAttempts := make(map[string]int)

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadAttempts[pluginID]++

				// Prevent infinite recursion by limiting attempts
				if downloadAttempts[pluginID] > 1 {
					return nil, plugins.ErrPluginNotInstalled
				}

				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
					if version == "" {
						targetDir = pluginID + "-1.0.0"
					}
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": "1.0.0",
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				archive := &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}

				// Create circular dependency: plugin-a depends on plugin-b, plugin-b depends on plugin-a
				if pluginID == "plugin-a" {
					archive.Dependencies = []*storage.Dependency{
						{ID: "plugin-b"},
					}
				} else if pluginID == "plugin-b" {
					archive.Dependencies = []*storage.Dependency{
						{ID: "plugin-a"},
					}
				}

				return archive, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "plugin-a", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.Error(t, err, "Circular dependencies should be detected and fail")
		require.Contains(t, err.Error(), "failed to ensure dependency")
		require.Nil(t, bundles)
	})

	t.Run("URL-based plugin downloads", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadCalled := false

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadCalled = true

				// Verify URL is passed in options
				require.Equal(t, "https://example.com/plugin.zip", opts.URL())

				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": version,
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{
				{ID: "test-plugin", Version: "1.0.0", URL: "https://example.com/plugin.zip"},
			},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.NotNil(t, bundles)
		require.True(t, downloadCalled)
		require.Len(t, bundles, 1)
		require.Equal(t, "test-plugin", bundles[0].Primary.JSONData.ID)
	})
}

func TestPreinstallSource_DownloadAndResolveVersion(t *testing.T) {
	t.Run("Version mismatch in resolved plugin", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
					if version == "" {
						targetDir = pluginID + "-1.0.0"
					}
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))

				// Create plugin.json with different version than expected
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": "2.0.0", // Different from expected 1.0.0
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: "1.0.0"}},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// This should work fine - the downloadAndResolveVersion method reads the actual version from plugin.json
		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.NotNil(t, bundles)
		require.Len(t, bundles, 1)
		require.Equal(t, "test-plugin", bundles[0].Primary.JSONData.ID)
	})

	t.Run("Temp directory cleanup on error", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
					if version == "" {
						targetDir = pluginID + "-1.0.0"
					}
				}

				// Create the plugin directory but don't create plugin.json to cause error
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				// Don't create plugin.json to cause error in downloadAndResolveVersion

				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{{ID: "test-plugin", Version: ""}}, // No version to trigger downloadAndResolveVersion
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		bundles, err := source.Discover(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "no such file or directory")
		require.Nil(t, bundles)

		// Verify temp directory was cleaned up
		entries, err := os.ReadDir(tmpDir)
		require.NoError(t, err)
		// Should not have any .tmp_ directories
		for _, entry := range entries {
			require.False(t, entry.Name()[:4] == ".tmp", "Temp directory should be cleaned up")
		}
	})
}

func TestPreinstallSource_EmptyPluginList(t *testing.T) {
	source := NewPreinstallSyncSource(
		[]setting.InstallPlugin{},
		&mockDownloader{},
		"/tmp",
		&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: "/tmp"}},
		"10.0.0",
	)

	bundles, err := source.Discover(context.Background())
	require.NoError(t, err)
	require.Empty(t, bundles)
}

func TestPreinstallSource_URLChangeDetection(t *testing.T) {
	t.Run("URL change triggers re-download when version is not specified", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadCount := 0
		downloadURLs := []string{}

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadCount++
				downloadURLs = append(downloadURLs, opts.URL())

				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
					if version == "" {
						targetDir = pluginID + "-1.0.0"
					}
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": "1.0.0",
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{
				{ID: "test-plugin", Version: "", URL: "https://example.com/plugin-v1.zip"},
			},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// First discovery with URL v1
		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.Len(t, bundles, 1)
		require.Equal(t, 1, downloadCount)
		require.Equal(t, "https://example.com/plugin-v1.zip", downloadURLs[0])

		// Update the source with URL v2
		source.pluginsToInstall = []setting.InstallPlugin{
			{ID: "test-plugin", Version: "", URL: "https://example.com/plugin-v2.zip"},
		}

		// Second discovery with URL v2 should trigger re-download
		bundles, err = source.Discover(context.Background())
		require.NoError(t, err)
		require.Len(t, bundles, 1)
		require.Equal(t, 2, downloadCount) // Should have downloaded again
		require.Equal(t, "https://example.com/plugin-v2.zip", downloadURLs[1])
	})

	t.Run("URL change does not trigger re-download when version is specified", func(t *testing.T) {
		tmpDir := t.TempDir()
		downloadCount := 0

		downloader := &mockDownloader{
			downloadFunc: func(ctx context.Context, pluginID, version string, opts plugins.AddOpts) (*storage.ExtractedPluginArchive, error) {
				downloadCount++

				// Use the custom dir function from opts to get the target directory
				customDirFunc := opts.CustomDirNameFunc()
				var targetDir string
				if customDirFunc != nil {
					targetDir = customDirFunc(pluginID)
				} else {
					targetDir = pluginID + "-" + version
				}

				// Create the plugin directory and JSON file
				pluginDir := filepath.Join(tmpDir, targetDir)
				require.NoError(t, os.MkdirAll(pluginDir, 0755))
				pluginJSON := map[string]interface{}{
					"id":   pluginID,
					"name": pluginID,
					"type": "datasource",
					"info": map[string]string{
						"version": version,
					},
				}
				data, _ := json.Marshal(pluginJSON)
				require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644))

				return &storage.ExtractedPluginArchive{
					ID:      pluginID,
					Version: version,
					Path:    pluginDir,
				}, nil
			},
		}

		source := NewPreinstallSyncSource(
			[]setting.InstallPlugin{
				{ID: "test-plugin", Version: "1.0.0", URL: "https://example.com/plugin-v1.zip"},
			},
			downloader,
			tmpDir,
			&mockConfigProvider{pCfg: &config.PluginManagementCfg{PluginsPath: tmpDir}},
			"10.0.0",
		)

		// First discovery with URL v1
		bundles, err := source.Discover(context.Background())
		require.NoError(t, err)
		require.Len(t, bundles, 1)
		require.Equal(t, 1, downloadCount)

		// Update the source with URL v2
		source.pluginsToInstall = []setting.InstallPlugin{
			{ID: "test-plugin", Version: "1.0.0", URL: "https://example.com/plugin-v2.zip"},
		}

		// Second discovery with URL v2 should NOT trigger re-download because version is specified
		bundles, err = source.Discover(context.Background())
		require.NoError(t, err)
		require.Len(t, bundles, 1)
		require.Equal(t, 1, downloadCount) // Should NOT have downloaded again
	})
}
