package meta

import (
	"context"
	"path"
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
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

const (
	defaultCoreTTL = 24 * time.Hour
)

// CoreProvider retrieves plugin metadata for core plugins.
type CoreProvider struct {
	mu             sync.RWMutex
	loadedPlugins  map[string]pluginsv0alpha1.MetaSpec
	initialized    bool
	ttl            time.Duration
	loader         pluginsLoader.Service
	staticRootPath string
	logger         logging.Logger
}

type CoreProviderOpts struct {
	// StaticRootPath is a function returning the absolute path to the static root
	// (i.e. the "public/" directory). Core plugins are expected at <StaticRootPath>/app/plugins.
	StaticRootPath func() (string, error)
	// CDNAssets controls whether asset paths are returned relative to StaticRootPath
	// so that the frontend can prepend a CDN domain. Set to true when running in
	// standalone (MT apiserver) mode.
	CDNAssets bool
}

// NewCoreProvider creates a new CoreProvider for core plugins.
func NewCoreProvider(logger logging.Logger, opts CoreProviderOpts) (*CoreProvider, error) {
	staticRootPath, err := opts.StaticRootPath()
	if err != nil {
		logger.Warn("Could not get static root path", "error", err)
		return nil, err
	}

	return NewCoreProviderWithTTL(logger, staticRootPath, opts.CDNAssets, defaultCoreTTL), nil
}

// NewCoreProviderWithTTL creates a new CoreProvider with a custom TTL.
func NewCoreProviderWithTTL(logger logging.Logger, staticRootPath string, cdnAssets bool, ttl time.Duration) *CoreProvider {
	return &CoreProvider{
		loadedPlugins:  make(map[string]pluginsv0alpha1.MetaSpec),
		ttl:            ttl,
		loader:         createLoader(cdnAssets, staticRootPath),
		staticRootPath: staticRootPath,
		logger:         logger,
	}
}

func (p *CoreProvider) Init(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.initialized {
		return nil
	}

	if err := p.loadPlugins(ctx); err != nil {
		p.logger.WithContext(ctx).Error("Could not load core plugins", "error", err)
		p.initialized = true
		return err
	}
	p.initialized = true
	return nil
}

// Name returns the name of the provider.
func (p *CoreProvider) Name() string {
	return "core"
}

// GetMeta retrieves plugin metadata for core plugins.
func (p *CoreProvider) GetMeta(ctx context.Context, ref PluginRef) (*Result, error) {
	p.mu.RLock()
	if meta, found := p.loadedPlugins[ref.ID]; found {
		p.mu.RUnlock()
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}
	initialized := p.initialized
	p.mu.RUnlock()

	if initialized {
		return nil, ErrMetaNotFound
	}

	if err := p.Init(ctx); err != nil {
		return nil, ErrMetaNotFound
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	if meta, found := p.loadedPlugins[ref.ID]; found {
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}

	return nil, ErrMetaNotFound
}

// loadPlugins discovers and caches all core plugins by fully loading them.
// Returns an error if the plugins path cannot be found or if plugin loading fails.
// This error will be handled gracefully by GetMeta, which will return ErrMetaNotFound
// to allow other providers to handle the request.
func (p *CoreProvider) loadPlugins(ctx context.Context) error {
	pluginsPath := filepath.Join(p.staticRootPath, "app", "plugins")
	src := sources.NewLocalSource(plugins.ClassCore, []string{pluginsPath})
	loadedPlugins, err := p.loader.Load(ctx, src)
	if err != nil {
		return err
	}

	if len(loadedPlugins) == 0 {
		p.logger.WithContext(ctx).Warn("No core plugins found during loading")
		return nil
	}

	for _, plugin := range loadedPlugins {
		metaSpec := pluginToMetaSpec(plugin)
		p.loadedPlugins[plugin.ID] = metaSpec
	}

	return nil
}

// createLoader creates a loader service configured for core plugins.
func createLoader(cdnAssets bool, staticRootPath string) pluginsLoader.Service {
	cfg := &config.PluginManagementCfg{}
	constructFunc := bootstrap.DefaultConstructFunc(cfg, signature.DefaultCalculator(cfg), pluginassets.NewLocalProvider())
	if cdnAssets {
		constructFunc = bootstrap.DefaultConstructFunc(cfg, signature.DefaultCalculator(cfg), newAssetProvider(staticRootPath))
	}

	d := discovery.New(cfg, discovery.Opts{
		FilterFuncs: []discovery.FilterFunc{
			// Allow all plugin types for core plugins
		},
	})
	b := bootstrap.New(cfg, bootstrap.Opts{
		ConstructFunc: constructFunc,
		DecorateFuncs: []bootstrap.DecorateFunc{
			bootstrap.LoadingStrategyDecorateFunc(cfg, pluginscdn.ProvideService(cfg)),
		}, // no decoration required for metadata
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

type assetProvider struct {
	// staticRootPath is the absolute path to the static root ("public/" directory).
	staticRootPath string
}

func newAssetProvider(staticRootPath string) *assetProvider {
	return &assetProvider{staticRootPath: staticRootPath}
}

func (p *assetProvider) Module(pi pluginassets.PluginInfo) (string, error) {
	if filepath.Base(pi.FS.Base()) != "dist" {
		return path.Join("core:plugin", filepath.Base(pi.FS.Base())), nil
	}

	return p.AssetPath(pi, "module.js")
}

func (p *assetProvider) AssetPath(pi pluginassets.PluginInfo, assetPath ...string) (string, error) {
	absPath := filepath.Join(pi.FS.Base(), filepath.Join(assetPath...))
	rel, err := filepath.Rel(p.staticRootPath, absPath)
	if err != nil {
		return absPath, nil
	}
	return filepath.ToSlash(rel), nil
}
