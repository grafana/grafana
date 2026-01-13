package meta

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	defaultLocalTTL = 1 * time.Hour
)

// LocalProvider retrieves plugin metadata for locally installed plugins.
// It uses the plugin store to access plugins that have already been loaded.
type LocalProvider struct {
	store pluginstore.Store
}

// NewLocalProvider creates a new LocalProvider for locally installed plugins.
// pluginAssets is kept for backward compatibility but is no longer used.
func NewLocalProvider(pluginStore pluginstore.Store) *LocalProvider {
	return &LocalProvider{
		store: pluginStore,
	}
}

// GetMeta retrieves plugin metadata for locally installed plugins.
func (p *LocalProvider) GetMeta(ctx context.Context, pluginID, version string) (*Result, error) {
	plugin, exists := p.store.Plugin(ctx, pluginID)
	if !exists {
		return nil, ErrMetaNotFound
	}

	spec := pluginStorePluginToMeta(plugin, plugin.LoadingStrategy, plugin.ModuleHash)
	return &Result{
		Meta: spec,
		TTL:  defaultLocalTTL,
	}, nil
}
