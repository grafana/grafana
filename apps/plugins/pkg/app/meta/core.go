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
	"github.com/grafana/grafana/pkg/plugins/config"
	pluginsLoader "github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
)

const (
	defaultCoreTTL = 24 * time.Hour
)

// CoreProvider retrieves plugin metadata for core plugins.
type CoreProvider struct {
	mu            sync.RWMutex
	loadedPlugins map[string]pluginsv0alpha1.MetaSpec
	initialized   bool
	ttl           time.Duration
	loader        pluginsLoader.Service
}

// NewCoreProvider creates a new CoreProvider for core plugins.
func NewCoreProvider() *CoreProvider {
	return NewCoreProviderWithTTL(defaultCoreTTL)
}

// NewCoreProviderWithTTL creates a new CoreProvider with a custom TTL.
func NewCoreProviderWithTTL(ttl time.Duration) *CoreProvider {
	cfg := &config.PluginManagementCfg{
		Features: config.Features{},
	}
	return &CoreProvider{
		loadedPlugins: make(map[string]pluginsv0alpha1.MetaSpec),
		ttl:           ttl,
		loader:        createLoader(cfg),
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

// loadPlugins discovers and caches all core plugins by fully loading them.
// Returns an error if the static root path cannot be found or if plugin loading fails.
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
	loadedPlugins, err := p.loader.Load(ctx, src)
	if err != nil {
		return err
	}

	if len(loadedPlugins) == 0 {
		logging.DefaultLogger.Warn("CoreProvider: no core plugins found during loading")
		return nil
	}

	for _, plugin := range loadedPlugins {
		metaSpec := pluginToMetaSpec(plugin)
		p.loadedPlugins[plugin.ID] = metaSpec
	}

	return nil
}

// createLoader creates a loader service configured for core plugins.
func createLoader(cfg *config.PluginManagementCfg) pluginsLoader.Service {
	d := discovery.New(cfg, discovery.Opts{
		FilterFuncs: []discovery.FilterFunc{
			// Allow all plugin types for core plugins
		},
	})
	b := bootstrap.New(cfg, bootstrap.Opts{
		DecorateFuncs: []bootstrap.DecorateFunc{}, // no decoration required for metadata
	})
	v := validation.New(cfg, validation.Opts{
		ValidateFuncs: []validation.ValidateFunc{
			// Skip validation for core plugins - they're trusted
		},
	})
	i := initialization.New(cfg, initialization.Opts{
		InitializeFuncs: []initialization.InitializeFunc{
			// Skip initialization - we only need metadata, not running plugins
		},
	})
	t, _ := termination.New(cfg, termination.Opts{
		TerminateFuncs: []termination.TerminateFunc{
			// No termination needed for metadata-only loading
		},
	})

	et := pluginerrs.ProvideErrorTracker()

	return pluginsLoader.New(cfg, d, b, v, i, t, et)
}

