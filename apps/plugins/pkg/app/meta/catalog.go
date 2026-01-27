package meta

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginfs"
)

const (
	defaultCatalogTTL = 1 * time.Hour
)

// CatalogProvider retrieves plugin metadata from the grafana.com API.
type CatalogProvider struct {
	grafanaComAPIURL   string
	grafanaComAPIToken string
	loader             pluginsLoader.Service
	ttl                time.Duration

	mu         sync.RWMutex
	cachedMeta map[string]pluginsv0alpha1.MetaSpec
}

// NewCatalogProvider creates a new CatalogProvider that fetches metadata from grafana.com.
func NewCatalogProvider(grafanaComAPIURL, grafanaComAPIToken string) *CatalogProvider {
	return NewCatalogProviderWithTTL(grafanaComAPIURL, grafanaComAPIToken, defaultCatalogTTL)
}

// NewCatalogProviderWithTTL creates a new CatalogProvider with a custom TTL.
func NewCatalogProviderWithTTL(grafanaComAPIURL, grafanaComAPIToken string, ttl time.Duration) *CatalogProvider {
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	return &CatalogProvider{
		grafanaComAPIURL:   grafanaComAPIURL,
		grafanaComAPIToken: grafanaComAPIToken,
		loader: createCatalogLoader(&config.PluginManagementCfg{
			PluginSettings:     config.PluginSettings{},
			GrafanaComAPIURL:   grafanaComAPIURL,
			GrafanaComAPIToken: grafanaComAPIToken,
			Features:           config.Features{},
		}),
		ttl:        ttl,
		cachedMeta: make(map[string]pluginsv0alpha1.MetaSpec),
	}
}

// GetMeta fetches plugin metadata from grafana.com API endpoint:
// GET /api/plugins/{pluginId}/versions/{version}
func (p *CatalogProvider) GetMeta(ctx context.Context, pluginID, version string) (*Result, error) {
	p.mu.RLock()
	if meta, found := p.cachedMeta[cacheKey(pluginID, version)]; found {
		p.mu.RUnlock()
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}
	p.mu.RUnlock()

	source, err := newCatalogSource(p.grafanaComAPIURL, p.grafanaComAPIToken, pluginID, version)
	if err != nil {
		return nil, fmt.Errorf("failed to create catalog source: %w", err)
	}

	loadedPlugins, err := p.loader.Load(ctx, source)
	if err != nil {
		return nil, fmt.Errorf("failed to load plugin: %w", err)
	}

	if len(loadedPlugins) == 0 {
		return nil, ErrMetaNotFound
	}

	p.mu.Lock()
	for _, plugin := range loadedPlugins {
		p.cachedMeta[cacheKey(plugin.ID, version)] = pluginToMetaSpec(plugin)
	}
	p.mu.Unlock()

	p.mu.RLock()
	metaSpec, found := p.cachedMeta[cacheKey(pluginID, version)]
	p.mu.RUnlock()

	if !found {
		return nil, ErrMetaNotFound
	}

	return &Result{
		Meta: metaSpec,
		TTL:  p.ttl,
	}, nil
}

func cacheKey(pluginID, version string) string {
	return fmt.Sprintf("%s:%s", pluginID, version)
}

// createCatalogLoader creates a loader service configured for catalog plugins.
func createCatalogLoader(cfg *config.PluginManagementCfg) pluginsLoader.Service {
	d := discovery.New(cfg, discovery.Opts{}) // No filters required
	b := bootstrap.New(cfg, bootstrap.Opts{}) // Default bootstrapping required
	v := validation.New(cfg, validation.Opts{
		ValidateFuncs: []validation.ValidateFunc{
			// Skip validation for catalog plugins
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

var _ plugins.PluginSource = (*catalogSource)(nil)

type catalogSource struct {
	pluginID      string
	pluginVersion string

	grafanaComAPIURL   string
	grafanaComAPIToken string
	httpClient         *http.Client

	// cached grafana.com metadata
	mu             sync.RWMutex
	cachedGcomMeta *grafanaComPluginVersionMeta
}

// newCatalogSource creates a catalog source from plugin ID and version.
// It will fetch metadata from grafana.com API and discover plugins from the CDN URL.
func newCatalogSource(grafanaComAPIURL, grafanaComAPIToken, pluginID, pluginVersion string) (*catalogSource, error) {
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	return &catalogSource{
		pluginID:           pluginID,
		pluginVersion:      pluginVersion,
		grafanaComAPIURL:   grafanaComAPIURL,
		grafanaComAPIToken: grafanaComAPIToken,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

func (c *catalogSource) PluginClass(_ context.Context) plugins.Class {
	return plugins.ClassExternal
}

func (c *catalogSource) DefaultSignature(ctx context.Context, _ string) (plugins.Signature, bool) {
	c.mu.RLock()
	gcomMeta := c.cachedGcomMeta
	c.mu.RUnlock()

	if gcomMeta == nil {
		var err error
		gcomMeta, err = c.fetchGrafanaComMeta(ctx)
		if err != nil {
			return plugins.Signature{}, false
		}
	}

	return signatureFromGcomMeta(gcomMeta), true
}

func (c *catalogSource) Discover(ctx context.Context) ([]*plugins.FoundBundle, error) {
	gcomMeta, err := c.fetchGrafanaComMeta(ctx)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	if c.cachedGcomMeta == nil {
		c.cachedGcomMeta = gcomMeta
	}
	c.mu.Unlock()

	if gcomMeta.CDNURL == "" {
		return nil, fmt.Errorf("no CDN URL found in grafana.com metadata for plugin %s version %s", c.pluginID, c.pluginVersion)
	}

	bundles := []*plugins.FoundBundle{
		{
			Primary: plugins.FoundPlugin{
				JSONData: metaJSONDataToJSONData(gcomMeta.JSON),
				FS:       pluginfs.NewCDNFS(gcomMeta.CDNURL, c.httpClient),
			},
		},
	}

	for _, child := range gcomMeta.Children {
		childPath, err := url.JoinPath(gcomMeta.CDNURL, child.Path)
		if err != nil {
			return nil, err
		}

		bundles[0].Children = append(bundles[0].Children, &plugins.FoundPlugin{
			JSONData: metaJSONDataToJSONData(child.JSON),
			FS:       pluginfs.NewCDNFS(childPath, c.httpClient),
		})
	}

	return bundles, nil
}

// fetchGrafanaComMeta fetches plugin metadata from grafana.com API
func (c *catalogSource) fetchGrafanaComMeta(ctx context.Context) (*grafanaComPluginVersionMeta, error) {
	c.mu.RLock()
	if c.cachedGcomMeta != nil {
		cached := c.cachedGcomMeta
		c.mu.RUnlock()
		return cached, nil
	}
	c.mu.RUnlock()

	gcomPluginVersionsURL, err := url.JoinPath(c.grafanaComAPIURL, c.pluginID, "versions", c.pluginVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to build API URL: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, gcomPluginVersionsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-plugins-app")
	if c.grafanaComAPIToken != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.grafanaComAPIToken))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch plugin metadata: %w", err)
	}
	defer func() {
		err = resp.Body.Close()
		if err != nil {
			logging.FromContext(ctx).Warn("CatalogSource: Failed to close response body", "url", gcomPluginVersionsURL)
		}
	}()

	if resp.StatusCode == http.StatusNotFound {
		logging.FromContext(ctx).Warn("CatalogSource: Plugin metadata not found", "pluginId", c.pluginID, "version", c.pluginVersion, "url", gcomPluginVersionsURL)
		return nil, ErrMetaNotFound
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code %d from grafana.com API %s", resp.StatusCode, req.RequestURI)
	}

	var gcomMeta grafanaComPluginVersionMeta
	if err = json.NewDecoder(resp.Body).Decode(&gcomMeta); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &gcomMeta, nil
}

// signatureFromGcomMeta builds a plugins.Signature from grafana.com metadata.
func signatureFromGcomMeta(gcomMeta *grafanaComPluginVersionMeta) plugins.Signature {
	if gcomMeta.SignatureType == "" {
		return plugins.Signature{Status: plugins.SignatureStatusUnsigned}
	}

	return plugins.Signature{
		Status:     plugins.SignatureStatusValid,
		Type:       plugins.SignatureType(gcomMeta.SignatureType),
		SigningOrg: gcomMeta.SignedByOrgName,
	}
}
