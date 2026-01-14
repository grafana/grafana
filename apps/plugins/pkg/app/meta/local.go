package meta

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	defaultLocalTTL = 1 * time.Hour
)

// PluginAssetsCalculator is an interface for calculating plugin asset information.
// LocalProvider requires this to calculate loading strategy and module hash.
type PluginAssetsCalculator interface {
	LoadingStrategy(ctx context.Context, p pluginstore.Plugin) plugins.LoadingStrategy
	ModuleHash(ctx context.Context, p pluginstore.Plugin) string
}

// LocalProvider retrieves plugin metadata for locally installed plugins.
// It uses the plugin store to access plugins that have already been loaded.
type LocalProvider struct {
	store        pluginstore.Store
	pluginAssets PluginAssetsCalculator
}

// NewLocalProvider creates a new LocalProvider for locally installed plugins.
// pluginAssets is required for calculating loading strategy and module hash.
func NewLocalProvider(pluginStore pluginstore.Store, pluginAssets PluginAssetsCalculator) *LocalProvider {
	return &LocalProvider{
		store:        pluginStore,
		pluginAssets: pluginAssets,
	}
}

// GetMeta retrieves plugin metadata for locally installed plugins.
func (p *LocalProvider) GetMeta(ctx context.Context, pluginID, version string) (*Result, error) {
	plugin, exists := p.store.Plugin(ctx, pluginID)
	if !exists {
		return nil, ErrMetaNotFound
	}

	loadingStrategy := p.pluginAssets.LoadingStrategy(ctx, plugin)
	moduleHash := p.pluginAssets.ModuleHash(ctx, plugin)

	spec := pluginStorePluginToMeta(plugin, loadingStrategy, moduleHash)
	return &Result{
		Meta: spec,
		TTL:  defaultLocalTTL,
	}, nil
}
