package prometheus

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// Fetcher fetches available metrics from a Prometheus datasource
type Fetcher struct{}

// NewFetcher creates a new Prometheus metrics fetcher
func NewFetcher() *Fetcher {
	return &Fetcher{}
}

// prometheusResponse represents the Prometheus API response structure
type prometheusResponse struct {
	Status string   `json:"status"`
	Data   []string `json:"data"`
	Error  string   `json:"error,omitempty"`
}

// FetchMetrics queries Prometheus to get all available metric names
// It uses the /api/v1/label/__name__/values endpoint
// The provided HTTP client should have proper authentication configured
func (f *Fetcher) FetchMetrics(ctx context.Context, datasourceURL string, client *http.Client) ([]string, error) {
	// Build the API URL
	baseURL, err := url.Parse(datasourceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid datasource URL: %w", err)
	}

	// Prometheus metrics endpoint
	apiPath, err := url.Parse("/api/v1/label/__name__/values")
	if err != nil {
		return nil, fmt.Errorf("failed to parse API path: %w", err)
	}

	fullURL := baseURL.ResolveReference(apiPath)

	// Create the request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Execute the request using the provided authenticated client
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metrics from Prometheus: %w", err)
	}
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Prometheus API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response
	var promResp prometheusResponse
	if err := json.NewDecoder(resp.Body).Decode(&promResp); err != nil {
		return nil, fmt.Errorf("failed to decode Prometheus response: %w", err)
	}

	// Check Prometheus API status
	if promResp.Status != "success" {
		return nil, fmt.Errorf("Prometheus API returned error: %s", promResp.Error)
	}

	return promResp.Data, nil
}
