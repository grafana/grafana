package meta

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

const (
	defaultCatalogTTL = 6 * time.Hour
)

// CatalogProvider retrieves plugin metadata from the grafana.com API.
type CatalogProvider struct {
	httpClient         *http.Client
	grafanaComAPIURL   *url.URL
	grafanaComAPIToken string
	ttl                time.Duration
	logger             logging.Logger
}

// NewCatalogProvider creates a new CatalogProvider that fetches metadata from grafana.com.
func NewCatalogProvider(logger logging.Logger, grafanaComAPIURL, grafanaComAPIToken string) (*CatalogProvider, error) {
	return NewCatalogProviderWithTTL(logger, grafanaComAPIURL, grafanaComAPIToken, defaultCatalogTTL)
}

// NewCatalogProviderWithTTL creates a new CatalogProvider with a custom TTL.
func NewCatalogProviderWithTTL(logger logging.Logger, grafanaComAPIURL, grafanaComAPIToken string, ttl time.Duration) (*CatalogProvider, error) {
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	u, err := url.Parse(grafanaComAPIURL)
	if err != nil {
		return nil, fmt.Errorf("invalid grafana.com API URL: %w", err)
	}

	return &CatalogProvider{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		grafanaComAPIURL:   u,
		grafanaComAPIToken: grafanaComAPIToken,
		ttl:                ttl,
		logger:             logger,
	}, nil
}

// Name returns the name of the provider.
func (p *CatalogProvider) Name() string {
	return "catalog"
}

// GetMeta fetches plugin metadata from grafana.com API endpoint:
// GET /api/plugins/{pluginId}/versions/{version}
// If ParentID is set in the query, it fetches the parent plugin's version and
// filters for the child plugin ID in the children field.
func (p *CatalogProvider) GetMeta(ctx context.Context, ref PluginRef) (*Result, error) {
	logger := p.logger.WithContext(ctx)
	if ns, nsErr := request.NamespaceInfoFrom(ctx, false); nsErr == nil && ns.Value != "" {
		logger = logger.With("requestNamespace", ns.Value)
	}

	// An empty version would collapse the URL below to the "list all versions"
	// endpoint instead of "get this version"
	if ref.Version == "" {
		logger.Debug("Version is required to fetch plugin metadata from grafana.com API")
		return nil, &FetchError{Reason: "missing_version", Err: ErrMetaNotFound}
	}

	// Determine which plugin ID to use for the API request
	lookupID := ref.ID
	if ref.HasParent() {
		lookupID = ref.GetParentID()
	}

	// Copy the base URL so we don't mutate the shared p.grafanaComAPIURL across requests.
	catalogURL := *p.grafanaComAPIURL
	catalogURL.Path = path.Join(catalogURL.Path, lookupID, "versions", ref.Version)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, catalogURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "grafana-plugins-app")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.grafanaComAPIToken))

	resp, err := p.httpClient.Do(req)
	if err != nil {
		errType := "network"
		var netErr *url.Error
		if errors.As(err, &netErr) && netErr.Timeout() {
			errType = "timeout"
		}
		return nil, &FetchError{Reason: errType, Err: ErrMetaNotFound}
	}
	defer func() {
		if err = resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		// Every non-200 maps to ErrMetaNotFound because that is the signal the manager uses to try the
		// next provider. It does not mean the plugin is absent. Reason keeps the real status for metrics.
		statusErr := &FetchError{Reason: strconv.Itoa(resp.StatusCode), Err: ErrMetaNotFound}
		if resp.StatusCode == http.StatusNotFound {
			logger.Debug("Plugin metadata not found", "pluginId", lookupID, "version", ref.Version, "url", catalogURL.String())
			return nil, statusErr
		}
		logger.Error(fmt.Sprintf("unexpected status code %d from grafana.com API", resp.StatusCode))
		return nil, statusErr
	}

	var gcomMeta grafanaComPluginVersionMeta
	if err = json.NewDecoder(resp.Body).Decode(&gcomMeta); err != nil {
		return nil, &FetchError{Reason: "decode", Err: fmt.Errorf("failed to decode plugin version API response from %s: %w", p.grafanaComAPIURL, err)}
	}

	// If we're looking up a child plugin, filter for it in the children field
	if ref.HasParent() {
		return p.findChildMeta(ref, gcomMeta, logger)
	}

	metaSpec, err := grafanaComPluginVersionMetaToMetaSpec(logger, gcomMeta, "")
	if err != nil {
		return nil, convertError(logger, ref, fmt.Errorf("failed to convert plugin metadata: %w", err))
	}
	return &Result{
		Meta: metaSpec,
		TTL:  p.ttl,
	}, nil
}

// findChildMeta searches for a child plugin in the parent's children field.
func (p *CatalogProvider) findChildMeta(childRef PluginRef, parentMeta grafanaComPluginVersionMeta, logger logging.Logger) (*Result, error) {
	for _, child := range parentMeta.Children {
		if child.JSON.Id == childRef.ID {
			metaSpec, err := grafanaComChildPluginVersionToMetaSpec(logger, child, parentMeta)
			if err != nil {
				return nil, convertError(logger, childRef, fmt.Errorf("failed to convert child plugin metadata: %w", err))
			}
			return &Result{
				Meta: metaSpec,
				TTL:  p.ttl,
			}, nil
		}
	}

	logger.Debug("Child plugin not found in parent's children",
		"childId", childRef.ID,
		"parentId", parentMeta.PluginSlug,
		"childrenCount", len(parentMeta.Children),
	)
	return nil, ErrMetaNotFound
}

// convertError classifies a conversion failure for the fetch error metric.
func convertError(logger logging.Logger, ref PluginRef, err error) error {
	if errors.Is(err, ErrMissingCDNURL) {
		logger.Warn("grafana.com plugin version is missing cdnUrl", "pluginId", ref.ID, "version", ref.Version)
		return &FetchError{Reason: "missing_cdn_url", Err: err}
	}
	return &FetchError{Reason: "conversion", Err: err}
}
