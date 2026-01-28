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
	httpClient         *http.Client
	grafanaComAPIURL   string
	grafanaComAPIToken string
	ttl                time.Duration
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
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		grafanaComAPIURL:   grafanaComAPIURL,
		grafanaComAPIToken: grafanaComAPIToken,
		ttl:                ttl,
	}
}

// GetMeta fetches plugin metadata from grafana.com API endpoint:
// GET /api/plugins/{pluginId}/versions/{version}
// If ParentID is set in the query, it fetches the parent plugin's version and
// filters for the child plugin ID in the children field.
func (p *CatalogProvider) GetMeta(ctx context.Context, ref PluginRef) (*Result, error) {
	u, err := url.Parse(p.grafanaComAPIURL)
	if err != nil {
		return nil, fmt.Errorf("invalid grafana.com API URL: %w", err)
	}

	// Determine which plugin ID to use for the API request
	lookupID := ref.ID
	if ref.HasParent() {
		lookupID = ref.GetParentID()
	}

	u.Path = path.Join(u.Path, lookupID, "versions", ref.Version)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-plugins-app")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.grafanaComAPIToken))

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch plugin metadata: %w", err)
	}
	defer func() {
		if err = resp.Body.Close(); err != nil {
			logging.FromContext(ctx).Warn("CatalogProvider: Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode == http.StatusNotFound {
		logging.FromContext(ctx).Warn("CatalogProvider: Plugin metadata not found", "pluginID", lookupID, "version", ref.Version, "url", u.String())
		return nil, ErrMetaNotFound
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code %d from grafana.com API", resp.StatusCode)
	}

	var gcomMeta grafanaComPluginVersionMeta
	if err = json.NewDecoder(resp.Body).Decode(&gcomMeta); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// If we're looking up a child plugin, filter for it in the children field
	if ref.HasParent() {
		return p.findChildMeta(ctx, ref.ID, gcomMeta)
	}

	metaSpec := grafanaComPluginVersionMetaToMetaSpec(gcomMeta)
	return &Result{
		Meta: metaSpec,
		TTL:  p.ttl,
	}, nil
}

// findChildMeta searches for a child plugin in the parent's children field.
func (p *CatalogProvider) findChildMeta(ctx context.Context, childID string, parentMeta grafanaComPluginVersionMeta) (*Result, error) {
	for _, child := range parentMeta.Children {
		if child.JSON.Id == childID {
			metaSpec := grafanaComChildPluginVersionToMetaSpec(child, parentMeta)
			return &Result{
				Meta: metaSpec,
				TTL:  p.ttl,
			}, nil
		}
	}

	logging.FromContext(ctx).Debug("CatalogProvider: Child plugin not found in parent's children",
		"childID", childID,
		"parentID", parentMeta.PluginID,
		"childrenCount", len(parentMeta.Children),
	)
	return nil, ErrMetaNotFound
}
