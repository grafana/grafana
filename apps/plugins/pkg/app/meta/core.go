package meta

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

const (
	defaultCoreTTL = 24 * time.Hour
)

// CoreProvider retrieves plugin metadata for core plugins.
type CoreProvider struct {
	mu            sync.RWMutex
	loadedPlugins map[string]pluginsv0alpha1.PluginMetaSpec
	initialized   bool
	ttl           time.Duration
}

// NewCoreProvider creates a new CoreProvider for core plugins.
func NewCoreProvider() *CoreProvider {
	return NewCoreProviderWithTTL(defaultCoreTTL)
}

// NewCoreProviderWithTTL creates a new CoreProvider with a custom TTL.
func NewCoreProviderWithTTL(ttl time.Duration) *CoreProvider {
	return &CoreProvider{
		loadedPlugins: make(map[string]pluginsv0alpha1.PluginMetaSpec),
		ttl:           ttl,
	}
}

// GetMeta retrieves plugin metadata for core plugins.
func (p *CoreProvider) GetMeta(ctx context.Context, pluginID, _ string) (*Result, error) {
	// Check cache first
	p.mu.RLock()
	if meta, found := p.loadedPlugins[pluginID]; found {
		p.mu.RUnlock()
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}
	p.mu.RUnlock()

	// Initialize cache if not already done
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	if meta, found := p.loadedPlugins[pluginID]; found {
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}

	if !p.initialized {
		if err := p.loadPlugins(ctx); err != nil {
			logging.DefaultLogger.Warn("CoreProvider: could not load core plugins, will return ErrMetaNotFound for all lookups", "error", err)
			// Mark as initialized even on failure so we don't keep trying
			p.initialized = true
			return nil, ErrMetaNotFound
		}
		p.initialized = true
	}

	if spec, found := p.loadedPlugins[pluginID]; found {
		return &Result{
			Meta: spec,
			TTL:  p.ttl,
		}, nil
	}

	return nil, ErrMetaNotFound
}

// loadPlugins discovers and caches all core plugins.
// Returns an error if the static root path cannot be found or if plugin discovery fails.
// This error will be handled gracefully by GetMeta, which will return ErrMetaNotFound
// to allow other providers to handle the request.
func (p *CoreProvider) loadPlugins(ctx context.Context) error {
	var staticRootPath string
	if wd, err := os.Getwd(); err == nil {
		// Check if we're in the Grafana root
		publicPath := filepath.Join(wd, "public", "app", "plugins")
		if _, err = os.Stat(publicPath); err == nil {
			staticRootPath = filepath.Join(wd, "public")
		}
	}

	if staticRootPath == "" {
		return errors.New("could not find Grafana static root path")
	}

	datasourcePath := filepath.Join(staticRootPath, "app", "plugins", "datasource")
	panelPath := filepath.Join(staticRootPath, "app", "plugins", "panel")

	src := sources.NewLocalSource(plugins.ClassCore, []string{datasourcePath, panelPath})
	ps, err := src.Discover(ctx)
	if err != nil {
		return err
	}

	if len(ps) == 0 {
		logging.DefaultLogger.Warn("CoreProvider: no core plugins found during discovery")
		return nil
	}

	for _, bundle := range ps {
		spec := pluginsv0alpha1.PluginMetaSpec{
			PluginJson: jsonDataToPluginMetaJSONData(bundle.Primary.JSONData),
		}
		p.loadedPlugins[bundle.Primary.JSONData.ID] = spec
	}

	return nil
}
