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

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

const (
	defaultCloudTTL = 1 * time.Hour
)

// CloudProvider retrieves plugin metadata from the grafana.com API.
type CloudProvider struct {
	httpClient       *http.Client
	grafanaComAPIURL string
	log              logging.Logger
	ttl              time.Duration
}

// NewCloudProvider creates a new CloudProvider that fetches metadata from grafana.com.
func NewCloudProvider(grafanaComAPIURL string) *CloudProvider {
	return NewCloudProviderWithTTL(grafanaComAPIURL, defaultCloudTTL)
}

// NewCloudProviderWithTTL creates a new CloudProvider with a custom TTL.
func NewCloudProviderWithTTL(grafanaComAPIURL string, ttl time.Duration) *CloudProvider {
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	return &CloudProvider{
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
func (p *CloudProvider) GetMeta(ctx context.Context, pluginID, version string) (*Result, error) {
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

	return &Result{
		Meta: gcomMeta.JSON,
		TTL:  p.ttl,
	}, nil
}

// grafanaComPluginVersionMeta represents the response from grafana.com API
// GET /api/plugins/{pluginId}/versions/{version}
type grafanaComPluginVersionMeta struct {
	PluginID        string                   `json:"pluginSlug"`
	Version         string                   `json:"version"`
	URL             string                   `json:"url"`
	Commit          string                   `json:"commit"`
	Description     string                   `json:"description"`
	Keywords        []string                 `json:"keywords"`
	CreatedAt       time.Time                `json:"createdAt"`
	UpdatedAt       time.Time                `json:"updatedAt"`
	JSON            *pluginsv0alpha1.GetMeta `json:"json"`
	Readme          string                   `json:"readme"`
	Downloads       int                      `json:"downloads"`
	Verified        bool                     `json:"verified"`
	Status          string                   `json:"status"`
	StatusContext   string                   `json:"statusContext"`
	DownloadSlug    string                   `json:"downloadSlug"`
	SignatureType   string                   `json:"signatureType"`
	SignedByOrg     string                   `json:"signedByOrg"`
	SignedByOrgName string                   `json:"signedByOrgName"`
	Packages        struct {
		Any struct {
			Md5         string `json:"md5"`
			Sha256      string `json:"sha256"`
			PackageName string `json:"packageName"`
			DownloadURL string `json:"downloadUrl"`
		} `json:"any"`
	} `json:"packages"`
	Links []struct {
		Rel  string `json:"rel"`
		Href string `json:"href"`
	} `json:"links"`
	AngularDetected bool     `json:"angularDetected"`
	Scopes          []string `json:"scopes"`
}
