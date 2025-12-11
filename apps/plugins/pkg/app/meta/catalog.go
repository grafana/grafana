package meta

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

const (
	defaultCatalogTTL = 1 * time.Hour
)

// CatalogProvider retrieves plugin metadata from the grafana.com API.
type CatalogProvider struct {
	httpClient       *http.Client
	grafanaComAPIURL string
	log              logging.Logger
	ttl              time.Duration
}

// NewCatalogProvider creates a new CatalogProvider that fetches metadata from grafana.com.
func NewCatalogProvider(grafanaComAPIURL string) *CatalogProvider {
	return NewCatalogProviderWithTTL(grafanaComAPIURL, defaultCatalogTTL)
}

// NewCatalogProviderWithTTL creates a new CatalogProvider with a custom TTL.
func NewCatalogProviderWithTTL(grafanaComAPIURL string, ttl time.Duration) *CatalogProvider {
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	return &CatalogProvider{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		grafanaComAPIURL: grafanaComAPIURL,
		log:              logging.DefaultLogger,
		ttl:              ttl,
	}
}

// GetMeta fetches plugin metadata from grafana.com API endpoint:
// GET /api/plugins/{pluginId}/versions/{version}
func (p *CatalogProvider) GetMeta(ctx context.Context, pluginID, version string) (*Result, error) {
	u, err := url.Parse(p.grafanaComAPIURL)
	if err != nil {
		return nil, fmt.Errorf("invalid grafana.com API URL: %w", err)
	}

	u.Path = path.Join(u.Path, pluginID, "versions", version)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-plugins-app")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch plugin metadata: %w", err)
	}
	defer func() {
		if err = resp.Body.Close(); err != nil {
			p.log.Warn("Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrMetaNotFound
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code %d from grafana.com API", resp.StatusCode)
	}

	var gcomMeta grafanaComPluginVersionMeta
	if err = json.NewDecoder(resp.Body).Decode(&gcomMeta); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	metaSpec := grafanaComPluginVersionMetaToMetaSpec(gcomMeta)
	return &Result{
		Meta: metaSpec,
		TTL:  p.ttl,
	}, nil
}
