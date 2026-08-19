package plugins

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/setting"
)

func testConfigProvider(t *testing.T, cfg *setting.Cfg) configprovider.ConfigProvider {
	t.Helper()
	provider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	return provider
}

type failingConfigProvider struct{}

func (failingConfigProvider) Get(context.Context) (*setting.Cfg, error) {
	return nil, errors.New("config unavailable")
}

func (failingConfigProvider) GetSections(context.Context, ...string) (*ini.File, error) {
	return nil, errors.New("config unavailable")
}

type nilConfigProvider struct{}

func (nilConfigProvider) Get(context.Context) (*setting.Cfg, error) {
	return nil, nil
}

func (nilConfigProvider) GetSections(context.Context, ...string) (*ini.File, error) {
	return ini.Empty(), nil
}

func mustParseURL(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	require.NoError(t, err)
	return u
}

func TestCDNAssetsEnabled(t *testing.T) {
	logger := &logging.NoOpLogger{}

	t.Run("cdn_url and build version set", func(t *testing.T) {
		cfg := &setting.Cfg{
			CDNRootURL:   mustParseURL(t, "http://cdn.grafana.com"),
			BuildVersion: "v7.5.0-11124",
		}

		assert.True(t, cdnAssetsEnabled(testConfigProvider(t, cfg), logger))
	})

	t.Run("cdn_url with a path prefix", func(t *testing.T) {
		cfg := &setting.Cfg{
			CDNRootURL:   mustParseURL(t, "http://cdn.grafana.com/sub"),
			BuildVersion: "v7.5.0-11124",
		}

		assert.True(t, cdnAssetsEnabled(testConfigProvider(t, cfg), logger))
	})

	t.Run("no cdn_url configured", func(t *testing.T) {
		cfg := &setting.Cfg{BuildVersion: "v7.5.0-11124"}

		assert.False(t, cdnAssetsEnabled(testConfigProvider(t, cfg), logger))
	})

	t.Run("cdn_url set but build version missing", func(t *testing.T) {
		cfg := &setting.Cfg{CDNRootURL: mustParseURL(t, "http://cdn.grafana.com")}

		assert.False(t, cdnAssetsEnabled(testConfigProvider(t, cfg), logger))
	})

	t.Run("config provider fails", func(t *testing.T) {
		assert.False(t, cdnAssetsEnabled(failingConfigProvider{}, logger))
	})

	t.Run("config provider returns no config", func(t *testing.T) {
		assert.False(t, cdnAssetsEnabled(nilConfigProvider{}, logger))
	})
}

func TestCoreProviderOpts(t *testing.T) {
	logger := &logging.NoOpLogger{}

	newStaticRoot := func(t *testing.T) string {
		t.Helper()
		staticRootPath := filepath.Join(t.TempDir(), "public")
		distDir := filepath.Join(staticRootPath, "app", "plugins", "datasource", "graphite", "dist")
		require.NoError(t, os.MkdirAll(distDir, 0750))

		pluginJSON := `{"id":"graphite","name":"Graphite","type":"datasource","info":{"version":"1.0.0"}}`
		require.NoError(t, os.WriteFile(filepath.Join(distDir, "plugin.json"), []byte(pluginJSON), 0644))

		return staticRootPath
	}

	emitted := func(t *testing.T, cfg *setting.Cfg) (meta.CoreProviderOpts, *meta.Result) {
		t.Helper()
		opts := coreProviderOpts(testConfigProvider(t, cfg), logger)

		provider, err := meta.NewCoreProvider(logger, opts)
		require.NoError(t, err)

		result, err := provider.GetMeta(context.Background(), meta.PluginRef{ID: "graphite"})
		require.NoError(t, err)

		return opts, result
	}

	t.Run("cdn hosted instance", func(t *testing.T) {
		staticRootPath := newStaticRoot(t)
		cfg := &setting.Cfg{
			StaticRootPath: staticRootPath,
			CDNRootURL:     mustParseURL(t, "http://cdn.grafana.com"),
			BuildVersion:   "v7.5.0-11124",
		}

		opts, result := emitted(t, cfg)

		assert.True(t, opts.CDNAssets)
		assert.Equal(t, "app/plugins/datasource/graphite/dist/module.js", result.Meta.Module.Path)
		assert.Equal(t, "app/plugins/datasource/graphite/dist", result.Meta.BaseURL)
		assert.NotContains(t, result.Meta.Module.Path, "cdn.grafana.com")
		assert.NotContains(t, result.Meta.BaseURL, "cdn.grafana.com")

		resolved, err := opts.StaticRootPath()
		require.NoError(t, err)
		assert.Equal(t, staticRootPath, resolved)
	})

	t.Run("self hosted instance", func(t *testing.T) {
		staticRootPath := newStaticRoot(t)
		cfg := &setting.Cfg{
			StaticRootPath: staticRootPath,
			BuildVersion:   "v7.5.0-11124",
		}

		opts, result := emitted(t, cfg)

		assert.False(t, opts.CDNAssets)
		assert.Equal(t, "plugins/graphite/module.js", result.Meta.Module.Path)
		assert.Equal(t, "plugins/graphite", result.Meta.BaseURL)

		resolved, err := opts.StaticRootPath()
		require.NoError(t, err)
		assert.Equal(t, staticRootPath, resolved)
	})
}
