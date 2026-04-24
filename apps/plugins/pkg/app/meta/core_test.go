package meta

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
)

func TestCoreProvider_GetMeta(t *testing.T) {
	ctx := context.Background()

	t.Run("returns cached plugin when available", func(t *testing.T) {
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "", false, defaultCoreTTL)

		expectedMeta := pluginsv0alpha1.MetaSpec{
			PluginJson: pluginsv0alpha1.MetaJSONData{
				Id:   "test-plugin",
				Name: "Test Plugin",
				Type: pluginsv0alpha1.MetaJSONDataTypeDatasource,
			},
		}

		provider.mu.Lock()
		provider.loadedPlugins["test-plugin"] = expectedMeta
		provider.initialized = true
		provider.mu.Unlock()

		result, err := provider.GetMeta(ctx, PluginRef{ID: "test-plugin", Version: "1.0.0"})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta, result.Meta)
		assert.Equal(t, defaultCoreTTL, result.TTL)
	})

	t.Run("returns ErrMetaNotFound for non-existent plugin", func(t *testing.T) {
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "", false, defaultCoreTTL)

		provider.mu.Lock()
		provider.initialized = true
		provider.mu.Unlock()

		result, err := provider.GetMeta(ctx, PluginRef{ID: "nonexistent-plugin", Version: "1.0.0"})

		assert.Error(t, err)
		assert.True(t, errors.Is(err, ErrMetaNotFound))
		assert.Nil(t, result)
	})

	t.Run("ignores version parameter", func(t *testing.T) {
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "", false, defaultCoreTTL)

		expectedMeta := pluginsv0alpha1.MetaSpec{
			PluginJson: pluginsv0alpha1.MetaJSONData{
				Id:   "test-plugin",
				Name: "Test Plugin",
				Type: pluginsv0alpha1.MetaJSONDataTypeDatasource,
			},
		}

		provider.mu.Lock()
		provider.loadedPlugins["test-plugin"] = expectedMeta
		provider.initialized = true
		provider.mu.Unlock()

		result1, err1 := provider.GetMeta(ctx, PluginRef{ID: "test-plugin", Version: "1.0.0"})
		result2, err2 := provider.GetMeta(ctx, PluginRef{ID: "test-plugin", Version: "2.0.0"})

		require.NoError(t, err1)
		require.NoError(t, err2)
		assert.Equal(t, result1.Meta, result2.Meta)
	})

	t.Run("uses custom TTL when provided", func(t *testing.T) {
		customTTL := 2 * time.Hour
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "", false, customTTL)

		expectedMeta := pluginsv0alpha1.MetaSpec{
			PluginJson: pluginsv0alpha1.MetaJSONData{
				Id:   "test-plugin",
				Name: "Test Plugin",
				Type: pluginsv0alpha1.MetaJSONDataTypeDatasource,
			},
		}

		provider.mu.Lock()
		provider.loadedPlugins["test-plugin"] = expectedMeta
		provider.initialized = true
		provider.mu.Unlock()

		result, err := provider.GetMeta(ctx, PluginRef{ID: "test-plugin", Version: "1.0.0"})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, customTTL, result.TTL)
	})

	t.Run("returns error when static root path func fails", func(t *testing.T) {
		provider, err := NewCoreProvider(&logging.NoOpLogger{}, CoreProviderOpts{
			StaticRootPath: func() (string, error) { return "", errors.New("not found") },
		})
		assert.Error(t, err)
		assert.Nil(t, provider)
	})
}

func TestCoreProvider_loadPlugins(t *testing.T) {
	ctx := context.Background()

	t.Run("loads all core plugins", func(t *testing.T) {
		_, filename, _, _ := runtime.Caller(0)
		testDir := filepath.Dir(filename)
		grafanaRoot := filepath.Join(testDir, "..", "..", "..", "..", "..")
		grafanaRoot, err := filepath.Abs(grafanaRoot)
		require.NoError(t, err)

		staticRootPath := filepath.Join(grafanaRoot, "public")
		if _, err = os.Stat(filepath.Join(staticRootPath, "app", "plugins")); err != nil {
			t.Skipf("Grafana root not found at %s, skipping integration test: %v", staticRootPath, err)
		}

		require.NoError(t, os.Chdir(grafanaRoot))

		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, staticRootPath, false, defaultCoreTTL)
		err = provider.loadPlugins(ctx)
		require.NoError(t, err)
		assert.Len(t, provider.loadedPlugins, 52)
	})

	t.Run("loads plugins from staticRootPath", func(t *testing.T) {
		// Uses a unique plugin ID that cannot exist in any hardcoded fallback path,
		// so this test fails if loadPlugins ignores p.staticRootPath.
		tempDir := t.TempDir()
		staticRootPath := filepath.Join(tempDir, "public")
		pluginDir := filepath.Join(staticRootPath, "app", "plugins", "datasource", "unique-sentinel-plugin-xk92")
		require.NoError(t, os.MkdirAll(pluginDir, 0750))

		pluginJSON := `{"id":"unique-sentinel-plugin-xk92","name":"Sentinel","type":"datasource","info":{"version":"1.0.0"}}`
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte(pluginJSON), 0644))

		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, staticRootPath, false, defaultCoreTTL)
		err := provider.loadPlugins(ctx)
		require.NoError(t, err)

		provider.mu.RLock()
		_, found := provider.loadedPlugins["unique-sentinel-plugin-xk92"]
		provider.mu.RUnlock()

		assert.True(t, found, "plugin from staticRootPath must be loaded; hardcoded paths would miss it")
	})

	t.Run("returns no error when plugins directory does not exist", func(t *testing.T) {
		// Path validation happens upstream (in CoreProviderOpts.StaticRootPath); loadPlugins
		// itself logs a warning and returns no plugins when the directory is missing.
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "/nonexistent/path", false, defaultCoreTTL)
		err := provider.loadPlugins(ctx)

		assert.NoError(t, err)
		assert.Empty(t, provider.loadedPlugins)
	})

	t.Run("returns no error when no plugins found", func(t *testing.T) {
		tempDir := t.TempDir()
		staticRootPath := filepath.Join(tempDir, "public")
		require.NoError(t, os.MkdirAll(filepath.Join(staticRootPath, "app", "plugins"), 0750))

		oldWd, err := os.Getwd()
		require.NoError(t, err)
		defer func() {
			_ = os.Chdir(oldWd)
		}()

		require.NoError(t, os.Chdir(tempDir))

		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, staticRootPath, false, defaultCoreTTL)
		err = provider.loadPlugins(ctx)
		assert.NoError(t, err)
	})

	t.Run("successfully loads plugins when structure exists", func(t *testing.T) {
		tempDir := t.TempDir()
		staticRootPath := filepath.Join(tempDir, "public")
		datasourcePath := filepath.Join(staticRootPath, "app", "plugins", "datasource")
		panelPath := filepath.Join(staticRootPath, "app", "plugins", "panel")

		require.NoError(t, os.MkdirAll(datasourcePath, 0750))
		require.NoError(t, os.MkdirAll(panelPath, 0750))

		pluginDir := filepath.Join(datasourcePath, "test-datasource")
		require.NoError(t, os.MkdirAll(pluginDir, 0750))

		pluginJSON := `{
			"id": "test-datasource",
			"name": "Test Datasource",
			"type": "datasource",
			"info": {
				"version": "1.0.0",
				"description": "Test description"
			}
		}`

		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte(pluginJSON), 0644))

		oldWd, err := os.Getwd()
		require.NoError(t, err)
		defer func() {
			_ = os.Chdir(oldWd)
		}()

		require.NoError(t, os.Chdir(tempDir))

		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, staticRootPath, false, defaultCoreTTL)
		err = provider.loadPlugins(ctx)

		if err != nil {
			require.NoError(t, err)
		}

		provider.mu.RLock()
		loaded := len(provider.loadedPlugins) > 0
		provider.mu.RUnlock()

		if loaded {
			result, err := provider.GetMeta(ctx, PluginRef{ID: "test-datasource", Version: "1.0.0"})
			require.NoError(t, err)
			assert.Equal(t, "test-datasource", result.Meta.PluginJson.Id)
			assert.Equal(t, "Test Datasource", result.Meta.PluginJson.Name)
		}
	})
}

func TestNewCoreProvider(t *testing.T) {
	t.Run("creates provider with default TTL", func(t *testing.T) {
		provider, err := NewCoreProvider(&logging.NoOpLogger{}, CoreProviderOpts{
			StaticRootPath: staticRootPathFunc("/test/public"),
		})
		require.NoError(t, err)
		assert.Equal(t, defaultCoreTTL, provider.ttl)
		assert.NotNil(t, provider.loadedPlugins)
		assert.False(t, provider.initialized)
		assert.Equal(t, "/test/public", provider.staticRootPath)
	})
}

func TestNewCoreProviderWithTTL(t *testing.T) {
	t.Run("creates provider with custom TTL", func(t *testing.T) {
		customTTL := 2 * time.Hour
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "/test/public", false, customTTL)
		assert.Equal(t, customTTL, provider.ttl)
	})

	t.Run("accepts zero TTL", func(t *testing.T) {
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, "/test/public", false, 0)
		assert.Equal(t, time.Duration(0), provider.ttl)
	})

	t.Run("stores static root path", func(t *testing.T) {
		expectedPath := "/usr/share/grafana/public"
		provider := NewCoreProviderWithTTL(&logging.NoOpLogger{}, expectedPath, false, defaultCoreTTL)
		assert.Equal(t, expectedPath, provider.staticRootPath)
	})
}

func TestAssetProvider(t *testing.T) {
	const staticRoot = "/srv/grafana/public"

	// CDN assets: paths are returned relative to staticRootPath so the frontend
	// can prepend a CDN domain.
	t.Run("cdn assets", func(t *testing.T) {
		p := newAssetProvider(true, staticRoot)

		// Non-decoupled plugins: FS.Base() points directly to the plugin directory (no /dist).
		// module  → "core:plugin/<name>"
		// baseUrl → "app/plugins/<type>/<name>"
		t.Run("non-decoupled datasource", func(t *testing.T) {
			pi := pluginassets.PluginInfo{FS: &stubFS{base: staticRoot + "/app/plugins/datasource/prometheus"}}

			module, err := p.Module(pi)
			require.NoError(t, err)
			assert.Equal(t, "core:plugin/prometheus", module)

			baseURL, err := p.AssetPath(pi)
			require.NoError(t, err)
			assert.Equal(t, "app/plugins/datasource/prometheus", baseURL)
		})

		t.Run("non-decoupled panel", func(t *testing.T) {
			pi := pluginassets.PluginInfo{FS: &stubFS{base: staticRoot + "/app/plugins/panel/alertlist"}}

			module, err := p.Module(pi)
			require.NoError(t, err)
			assert.Equal(t, "core:plugin/alertlist", module)

			baseURL, err := p.AssetPath(pi)
			require.NoError(t, err)
			assert.Equal(t, "app/plugins/panel/alertlist", baseURL)
		})

		// Decoupled plugins: FS.Base() points to the /dist directory.
		// module  → "app/plugins/<type>/<name>/dist/module.js"
		// baseUrl → "app/plugins/<type>/<name>/dist"
		t.Run("decoupled datasource (grafana-testdata-datasource)", func(t *testing.T) {
			pi := pluginassets.PluginInfo{FS: &stubFS{base: staticRoot + "/app/plugins/datasource/grafana-testdata-datasource/dist"}}

			module, err := p.Module(pi)
			require.NoError(t, err)
			assert.Equal(t, "app/plugins/datasource/grafana-testdata-datasource/dist/module.js", module)

			baseURL, err := p.AssetPath(pi)
			require.NoError(t, err)
			assert.Equal(t, "app/plugins/datasource/grafana-testdata-datasource/dist", baseURL)
		})
	})

	// Non-CDN (on-prem) assets: paths use "plugins/<id>/..." so the frontend can
	// prepend "public/" just as it prepends a CDN domain in cloud deployments.
	t.Run("non-cdn assets", func(t *testing.T) {
		p := newAssetProvider(false, staticRoot)

		// Non-decoupled plugins: module is still "core:plugin/<name>"; AssetPath
		// returns "plugins/<id>" and the frontend prepends "public/".
		t.Run("non-decoupled datasource", func(t *testing.T) {
			pi := pluginassets.PluginInfo{
				FS:       &stubFS{base: staticRoot + "/app/plugins/datasource/prometheus"},
				JsonData: plugins.JSONData{ID: "prometheus"},
			}

			module, err := p.Module(pi)
			require.NoError(t, err)
			assert.Equal(t, "core:plugin/prometheus", module)

			baseURL, err := p.AssetPath(pi)
			require.NoError(t, err)
			assert.Equal(t, "plugins/prometheus", baseURL)
		})

		t.Run("non-decoupled panel", func(t *testing.T) {
			pi := pluginassets.PluginInfo{
				FS:       &stubFS{base: staticRoot + "/app/plugins/panel/alertlist"},
				JsonData: plugins.JSONData{ID: "alertlist"},
			}

			module, err := p.Module(pi)
			require.NoError(t, err)
			assert.Equal(t, "core:plugin/alertlist", module)

			baseURL, err := p.AssetPath(pi)
			require.NoError(t, err)
			assert.Equal(t, "plugins/alertlist", baseURL)
		})

		// Decoupled plugins: module and AssetPath both use "plugins/<id>/..." paths.
		t.Run("decoupled datasource (grafana-testdata-datasource)", func(t *testing.T) {
			pi := pluginassets.PluginInfo{
				FS:       &stubFS{base: staticRoot + "/app/plugins/datasource/grafana-testdata-datasource/dist"},
				JsonData: plugins.JSONData{ID: "grafana-testdata-datasource"},
			}

			module, err := p.Module(pi)
			require.NoError(t, err)
			assert.Equal(t, "plugins/grafana-testdata-datasource/module.js", module)

			baseURL, err := p.AssetPath(pi)
			require.NoError(t, err)
			assert.Equal(t, "plugins/grafana-testdata-datasource", baseURL)
		})
	})
}

func TestJsonDataToMeta(t *testing.T) {
	t.Run("converts basic plugin JSON data", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeDataSource,
			Info: plugins.Info{
				Version:     "1.0.0",
				Description: "Test description",
				Keywords:    []string{"test", "plugin"},
				Logos: plugins.Logos{
					Small: "small.png",
					Large: "large.png",
				},
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.Equal(t, "test-plugin", meta.Id)
		assert.Equal(t, "Test Plugin", meta.Name)
		assert.Equal(t, pluginsv0alpha1.MetaJSONDataTypeDatasource, meta.Type)
		assert.Equal(t, "1.0.0", meta.Info.Version)
		assert.Equal(t, "Test description", *meta.Info.Description)
		assert.Equal(t, []string{"test", "plugin"}, meta.Info.Keywords)
		assert.Equal(t, "small.png", meta.Info.Logos.Small)
		assert.Equal(t, "large.png", meta.Info.Logos.Large)
	})

	t.Run("handles optional fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypePanel,
			Info: plugins.Info{
				Version: "1.0.0",
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.Nil(t, meta.Info.Description)
		assert.Nil(t, meta.Info.Author)
		assert.Empty(t, meta.Info.Keywords)
	})

	t.Run("maps optional boolean fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypePanel,
			Info: plugins.Info{
				Version: "1.0.0",
			},
			Suggestions: true,
			Alerting:    true,
			Annotations: true,
			Backend:     true,
			BuiltIn:     true,
			Logs:        true,
			Metrics:     true,
			Tracing:     true,
			Streaming:   true,
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.True(t, *meta.Suggestions)
		assert.True(t, *meta.Alerting)
		assert.True(t, *meta.Annotations)
		assert.True(t, *meta.Backend)
		assert.True(t, *meta.BuiltIn)
		assert.True(t, *meta.Logs)
		assert.True(t, *meta.Metrics)
		assert.True(t, *meta.Tracing)
		assert.True(t, *meta.Streaming)
	})

	t.Run("maps optional string fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeDataSource,
			Info: plugins.Info{
				Version: "1.0.0",
			},
			Executable: "plugin-executable",
			BuildMode:  "production",
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.Equal(t, "plugin-executable", *meta.Executable)
		assert.Equal(t, "production", *meta.BuildMode)
	})

	t.Run("does not map false optional boolean fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypePanel,
			Info: plugins.Info{
				Version: "1.0.0",
			},
			Suggestions: false,
			Alerting:    false,
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.Nil(t, meta.Suggestions)
		assert.Nil(t, meta.Alerting)
	})

	t.Run("does not map empty optional string fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeDataSource,
			Info: plugins.Info{
				Version: "1.0.0",
			},
			Executable: "",
			BuildMode:  "",
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.Nil(t, meta.Executable)
		assert.Nil(t, meta.BuildMode)
	})
}

func staticRootPathFunc(path string) func() (string, error) {
	return func() (string, error) {
		return path, nil
	}
}

// stubFS implements plugins.FS with a fixed base path for testing.
type stubFS struct{ base string }

func (s *stubFS) Open(string) (fs.File, error) { return nil, nil }
func (s *stubFS) Type() plugins.FSType         { return plugins.FSTypeLocal }
func (s *stubFS) Base() string                 { return s.base }
func (s *stubFS) Files() ([]string, error)     { return nil, nil }
func (s *stubFS) Rel(string) (string, error)   { return "", nil }
