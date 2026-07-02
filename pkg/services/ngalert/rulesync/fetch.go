// Package rulesync is the external Mimir/Cortex ruler sync: a background worker
// that mirrors alert rules from a configured ruler datasource into Grafana as
// converted-Prometheus rules (the rule-side analogue of the external
// Alertmanager config sync in pkg/services/ngalert/notifier).
package rulesync

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"io"
	"net/http"
	"net/url"

	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/validations"
)

// rulerConfigAPIPath is the Mimir/Cortex ruler config API path, appended to the
// datasource URL. It is deliberately the config API (rule group definitions),
// NOT the query API /api/v1/rules that vanilla Prometheus serves (which returns
// rule state, a different shape).
const rulerConfigAPIPath = "/config/v1/rules"

// RulerConfig is the namespace-grouped rule configuration returned by a
// Mimir/Cortex ruler config API — the exact shape the convert API already
// accepts (map[namespace][]PrometheusRuleGroup).
type RulerConfig = map[string][]apimodels.PrometheusRuleGroup

// ErrNotARuler indicates the datasource did not respond as a Mimir/Cortex ruler
// config API (unexpected non-2xx, or a 200 that does not parse as
// namespace-grouped rule configs), letting callers distinguish a misconfigured
// datasource from a transient network failure. An empty ruler (no rule groups)
// is NOT an error; see Fetch.
var ErrNotARuler = errors.New("datasource does not expose a Mimir/Cortex ruler config API")

// RulerFetcher fetches namespace-grouped rule configs from a Mimir/Cortex ruler
// datasource, using the datasource service's HTTP transport (so its configured
// auth/TLS/headers are honoured) and the same egress allow/deny-list validation
// the datasource proxy runs. Shared by the sync worker and the Config admission
// validator.
type RulerFetcher struct {
	datasourceService  datasources.DataSourceService
	httpClientProvider httpclient.Provider
	requestValidator   validations.DataSourceRequestValidator
}

// NewRulerFetcher constructs a RulerFetcher. requestValidator may not be nil —
// pass &validations.OSSDataSourceRequestValidator{} for the no-op default.
func NewRulerFetcher(
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	requestValidator validations.DataSourceRequestValidator,
) *RulerFetcher {
	return &RulerFetcher{
		datasourceService:  datasourceService,
		httpClientProvider: httpClientProvider,
		requestValidator:   requestValidator,
	}
}

// Fetch retrieves the ruler configuration from ds, returning the parsed configs
// and the FNV-1a hash of the raw body (for cross-tick dedup). A 404 is "no rules
// configured" (empty RulerConfig, nil error). A non-404 non-2xx, or a 200 whose
// body does not parse, yields ErrNotARuler.
//
// TODO: verify Mimir's empty-vs-absent response (404 vs 200 empty body) against
// a live ruler; the 404 handling mirrors Grafana's frontend ruler client.
func (f *RulerFetcher) Fetch(ctx context.Context, ds *datasources.DataSource) (RulerConfig, uint64, error) {
	configURL, err := buildRulerConfigURL(ds)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build ruler config URL: %w", err)
	}

	transport, err := f.datasourceService.GetHTTPTransport(ctx, ds, f.httpClientProvider)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to build datasource HTTP transport: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, configURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	// Mimir/Cortex serve the ruler config API as YAML.
	req.Header.Set("Accept", "application/yaml")

	// Apply allow/deny-list validation to the outbound request before sending,
	// using the same validator the user-driven datasource proxy runs.
	if f.requestValidator != nil {
		if err := f.requestValidator.Validate(ds.URL, ds.JsonDataMap(), req); err != nil {
			return nil, 0, fmt.Errorf("datasource request validation failed: %w", err)
		}
	}

	resp, err := transport.RoundTrip(req)
	if err != nil {
		return nil, 0, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// 404 → the tenant has no rule groups. Mirrors Grafana's frontend ruler
	// client, which treats 404 as an empty result.
	if resp.StatusCode == http.StatusNotFound {
		return RulerConfig{}, emptyHash, nil
	}

	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, 0, fmt.Errorf("%w: unexpected HTTP status %d: %s", ErrNotARuler, resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read response body: %w", err)
	}

	var cfg RulerConfig
	if err := yaml.Unmarshal(body, &cfg); err != nil {
		return nil, 0, fmt.Errorf("%w: failed to parse response as ruler config: %v", ErrNotARuler, err)
	}

	h := fnv.New64a()
	_, _ = h.Write(body)
	return cfg, h.Sum64(), nil
}

// emptyHash is the FNV-1a hash of an empty body, used for the no-rules (404)
// case so dedup treats "still empty" as unchanged across ticks.
var emptyHash = func() uint64 {
	h := fnv.New64a()
	return h.Sum64()
}()

// buildRulerConfigURL constructs the ruler config API URL by appending the
// config path to the datasource URL.
func buildRulerConfigURL(ds *datasources.DataSource) (string, error) {
	parsed, err := url.Parse(ds.URL)
	if err != nil {
		return "", fmt.Errorf("failed to parse datasource URL: %w", err)
	}
	return parsed.JoinPath(rulerConfigAPIPath).String(), nil
}
