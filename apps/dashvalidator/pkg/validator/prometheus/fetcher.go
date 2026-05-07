package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
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
		return nil, validator.NewValidationError(
			validator.ErrCodeDatasourceConfig,
			"invalid datasource URL",
			http.StatusBadRequest,
		).WithCause(err).WithDetail("url", datasourceURL)
	}

	// Append Prometheus API endpoint to base URL path using path.Join
	// This correctly handles datasources with existing paths (e.g., /api/prom)
	endpoint := "api/v1/label/__name__/values"
	baseURL.Path = path.Join(baseURL.Path, endpoint)

	// Create the request
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL.String(), nil)
	if err != nil {
		return nil, validator.NewValidationError(
			validator.ErrCodeInternal,
			"failed to create HTTP request",
			http.StatusInternalServerError,
		).WithCause(err)
	}

	// Execute the request using the provided authenticated client
	resp, err := client.Do(req)
	if err != nil {
		// Check if it's a timeout error
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(err.Error(), "timeout") {
			return nil, validator.NewAPITimeoutError(baseURL.String(), err)
		}
		// Network or connection error - datasource is unreachable
		return nil, validator.NewDatasourceUnreachableError("", datasourceURL, err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Read response body for error reporting
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		body = []byte("<unable to read response body>")
	}

	// Check HTTP status code
	switch resp.StatusCode {
	case http.StatusOK:
		// Success - continue to parse response
	case http.StatusUnauthorized, http.StatusForbidden:
		// Authentication or authorization failure
		return nil, validator.NewDatasourceAuthError("", resp.StatusCode).
			WithDetail("url", baseURL.String()).
			WithDetail("responseBody", string(body))
	case http.StatusNotFound:
		// Endpoint not found - might not be a valid Prometheus instance
		return nil, validator.NewAPIUnavailableError(
			resp.StatusCode,
			string(body),
			fmt.Errorf("endpoint not found - this may not be a valid Prometheus datasource"),
		).WithDetail("url", baseURL.String())
	case http.StatusTooManyRequests:
		// Rate limiting
		return nil, validator.NewValidationError(
			validator.ErrCodeAPIRateLimit,
			"Prometheus API rate limit exceeded",
			http.StatusTooManyRequests,
		).WithDetail("url", baseURL.String()).WithDetail("responseBody", string(body))
	case http.StatusServiceUnavailable, http.StatusBadGateway, http.StatusGatewayTimeout:
		// Upstream service is down or unavailable
		return nil, validator.NewAPIUnavailableError(resp.StatusCode, string(body), nil).
			WithDetail("url", baseURL.String())
	default:
		// Other error status codes
		return nil, validator.NewAPIUnavailableError(resp.StatusCode, string(body), nil).
			WithDetail("url", baseURL.String())
	}

	// Parse the response JSON
	var promResp prometheusResponse
	if err := json.Unmarshal(body, &promResp); err != nil {
		return nil, validator.NewAPIInvalidResponseError(
			"response is not valid JSON",
			err,
		).WithDetail("url", baseURL.String()).WithDetail("responseBody", string(body))
	}

	// Check Prometheus API status field
	if promResp.Status != "success" {
		errorMsg := promResp.Error
		if errorMsg == "" {
			errorMsg = "unknown error"
		}
		return nil, validator.NewAPIInvalidResponseError(
			fmt.Sprintf("Prometheus API returned error status: %s", errorMsg),
			nil,
		).WithDetail("url", baseURL.String()).WithDetail("prometheusError", errorMsg)
	}

	// Validate that we got data
	if promResp.Data == nil {
		return nil, validator.NewAPIInvalidResponseError(
			"response missing 'data' field",
			nil,
		).WithDetail("url", baseURL.String()).WithDetail("responseBody", string(body))
	}

	return promResp.Data, nil
}
