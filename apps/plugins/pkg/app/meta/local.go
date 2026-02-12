package meta

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/plugins/pluginassets/modulehash"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	defaultLocalTTL = 1 * time.Hour
)

// LocalProvider retrieves plugin metadata for locally installed plugins.
// It uses the plugin store to access plugins that have already been loaded.
type LocalProvider struct {
	store          pluginstore.Store
	moduleHashCalc *modulehash.Calculator
}

// NewLocalProvider creates a new LocalProvider for locally installed plugins.
func NewLocalProvider(pluginStore pluginstore.Store, moduleHashCalc *modulehash.Calculator) *LocalProvider {
	return &LocalProvider{
		store:          pluginStore,
		moduleHashCalc: moduleHashCalc,
	}
}

// GetMeta retrieves plugin metadata for locally installed plugins.
func (p *LocalProvider) GetMeta(ctx context.Context, ref PluginRef) (*Result, error) {
	plugin, exists := p.store.Plugin(ctx, ref.ID)
	if !exists {
		return nil, ErrMetaNotFound
	}

	moduleHash := p.moduleHashCalc.ModuleHash(ctx, ref.ID, ref.Version)
	spec := pluginStorePluginToMeta(plugin, moduleHash)
	return &Result{
		Meta: spec,
		TTL:  defaultLocalTTL,
	}, nil
}
