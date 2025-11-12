package meta

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
)

func TestCoreProvider_GetMeta(t *testing.T) {
	ctx := context.Background()

	t.Run("returns cached plugin when available", func(t *testing.T) {
		provider := NewCoreProvider()

		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider.mu.Lock()
		provider.loadedPlugins["test-plugin"] = expectedMeta
		provider.initialized = true
		provider.mu.Unlock()

		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta, result.Meta)
		assert.Equal(t, defaultCoreTTL, result.TTL)
	})

	t.Run("returns ErrMetaNotFound for non-existent plugin", func(t *testing.T) {
		provider := NewCoreProvider()

		provider.mu.Lock()
		provider.initialized = true
		provider.mu.Unlock()

		result, err := provider.GetMeta(ctx, "nonexistent-plugin", "1.0.0")

		assert.Error(t, err)
		assert.True(t, errors.Is(err, ErrMetaNotFound))
		assert.Nil(t, result)
	})

	t.Run("ignores version parameter", func(t *testing.T) {
		provider := NewCoreProvider()

		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider.mu.Lock()
		provider.loadedPlugins["test-plugin"] = expectedMeta
		provider.initialized = true
		provider.mu.Unlock()

		result1, err1 := provider.GetMeta(ctx, "test-plugin", "1.0.0")
		result2, err2 := provider.GetMeta(ctx, "test-plugin", "2.0.0")

		require.NoError(t, err1)
		require.NoError(t, err2)
		assert.Equal(t, result1.Meta, result2.Meta)
	})

	t.Run("uses custom TTL when provided", func(t *testing.T) {
		customTTL := 2 * time.Hour
		provider := NewCoreProviderWithTTL(customTTL)

		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider.mu.Lock()
		provider.loadedPlugins["test-plugin"] = expectedMeta
		provider.initialized = true
		provider.mu.Unlock()

		result, err := provider.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, customTTL, result.TTL)
	})
}

func TestCoreProvider_loadPlugins(t *testing.T) {
	ctx := context.Background()

	t.Run("loads all core plugins from Grafana codebase", func(t *testing.T) {
		_, filename, _, _ := runtime.Caller(0)
		testDir := filepath.Dir(filename)
		grafanaRoot := filepath.Join(testDir, "..", "..", "..", "..", "..")
		grafanaRoot, err := filepath.Abs(grafanaRoot)
		require.NoError(t, err)

		publicPath := filepath.Join(grafanaRoot, "public", "app", "plugins")
		if _, err = os.Stat(publicPath); err != nil {
			t.Skipf("Grafana root not found at %s, skipping integration test: %v", publicPath, err)
		}

		require.NoError(t, os.Chdir(grafanaRoot))

		provider := NewCoreProvider()
		err = provider.loadPlugins(ctx)
		require.NoError(t, err)
		assert.Len(t, provider.loadedPlugins, 53)
	})

	t.Run("returns error when static root path not found", func(t *testing.T) {
		tempDir := t.TempDir()

		oldWd, err := os.Getwd()
		require.NoError(t, err)
		defer func() {
			_ = os.Chdir(oldWd)
		}()

		require.NoError(t, os.Chdir(tempDir))

		provider := NewCoreProvider()
		err = provider.loadPlugins(ctx)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "could not find Grafana static root path")
	})

	t.Run("returns error when no plugins found", func(t *testing.T) {
		tempDir := t.TempDir()
		publicPath := filepath.Join(tempDir, "public", "app", "plugins")
		require.NoError(t, os.MkdirAll(publicPath, 0750))

		oldWd, err := os.Getwd()
		require.NoError(t, err)
		defer func() {
			_ = os.Chdir(oldWd)
		}()

		require.NoError(t, os.Chdir(tempDir))

		provider := NewCoreProvider()
		err = provider.loadPlugins(ctx)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "core plugins could not be found")
	})

	t.Run("successfully loads plugins when structure exists", func(t *testing.T) {
		tempDir := t.TempDir()
		publicPath := filepath.Join(tempDir, "public", "app", "plugins")
		datasourcePath := filepath.Join(publicPath, "datasource")
		panelPath := filepath.Join(publicPath, "panel")

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

		provider := NewCoreProvider()
		err = provider.loadPlugins(ctx)

		if err != nil {
			require.NoError(t, err)
		}

		provider.mu.RLock()
		loaded := len(provider.loadedPlugins) > 0
		provider.mu.RUnlock()

		if loaded {
			result, err := provider.GetMeta(ctx, "test-datasource", "1.0.0")
			require.NoError(t, err)
			assert.Equal(t, "test-datasource", result.Meta.Id)
			assert.Equal(t, "Test Datasource", result.Meta.Name)
		}
	})
}

func TestNewCoreProvider(t *testing.T) {
	t.Run("creates provider with default TTL", func(t *testing.T) {
		provider := NewCoreProvider()
		assert.Equal(t, defaultCoreTTL, provider.ttl)
		assert.NotNil(t, provider.loadedPlugins)
		assert.False(t, provider.initialized)
	})
}

func TestNewCoreProviderWithTTL(t *testing.T) {
	t.Run("creates provider with custom TTL", func(t *testing.T) {
		customTTL := 2 * time.Hour
		provider := NewCoreProviderWithTTL(customTTL)
		assert.Equal(t, customTTL, provider.ttl)
	})

	t.Run("accepts zero TTL", func(t *testing.T) {
		provider := NewCoreProviderWithTTL(0)
		assert.Equal(t, time.Duration(0), provider.ttl)
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

		meta := jsonDataToMeta(jsonData)

		assert.Equal(t, "test-plugin", meta.Id)
		assert.Equal(t, "Test Plugin", meta.Name)
		assert.Equal(t, pluginsv0alpha1.GetMetaTypeDatasource, meta.Type)
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

		meta := jsonDataToMeta(jsonData)

		assert.Nil(t, meta.Info.Description)
		assert.Nil(t, meta.Info.Author)
		assert.Empty(t, meta.Info.Keywords)
	})
}
