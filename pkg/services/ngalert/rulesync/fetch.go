// Package rulesync contains the external Mimir/Cortex ruler sync: a background
// worker that mirrors alert rules from a configured ruler datasource into
// Grafana as converted-Prometheus rules. It is the rule-side analogue of the
// external Alertmanager config sync in pkg/services/ngalert/notifier.
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
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/validations"
)

// rulerConfigAPIPath is the Mimir/Cortex ruler configuration API path. It is
// appended to the datasource URL (which the user configures to include any
// Prometheus HTTP prefix, e.g. /prometheus), mirroring how LotexRuler builds
// the ruler proxy path (pkg/services/ngalert/api/lotex_ruler.go: mimirPrefix).
// It is deliberately the config API (rule group definitions), NOT the query API
// /api/v1/rules (which vanilla Prometheus also serves but returns rule state, a
// different shape).
const rulerConfigAPIPath = "/config/v1/rules"

// RulerConfig is the namespace-grouped rule configuration returned by a
// Mimir/Cortex ruler config API — the exact shape the convert API already
// accepts (map[namespace][]PrometheusRuleGroup).
type RulerConfig = map[string][]apimodels.PrometheusRuleGroup

// ErrNotARuler indicates the datasource did not respond as a Mimir/Cortex ruler
// config API (an unexpected non-2xx status, or a 200 whose body does not parse
// as namespace-grouped rule configs). Callers use it to distinguish a
// misconfigured datasource (e.g. vanilla Prometheus, whose config API path does
// not exist) from a transient network failure, so the admission validator can
// reject the datasource and the syncer can surface a clear status.
//
// NOTE: an empty ruler (a real Mimir/Cortex tenant with no rule groups) is NOT
// an error — see Fetch. The exact empty-vs-absent response of Mimir (404 vs 200
// with an empty body) needs verifying against a live Mimir; the current
// handling mirrors Grafana's frontend ruler client, which treats 404 as "no
// rules".
var ErrNotARuler = errors.New("datasource does not expose a Mimir/Cortex ruler config API")

// RulerFetcher fetches namespace-grouped rule configs from a Mimir/Cortex ruler
// datasource. It uses the datasource service's HTTP transport so TLS, basic
// auth, bearer tokens, custom headers and OAuth pass-through configured on the
// datasource are honoured, and applies the same egress allow/deny-list
// validation the user-driven datasource proxy runs. Shared by the external
// ruler sync worker and the AlertingConfig admission validator.
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

// Fetch retrieves the ruler configuration from ds. It returns the parsed
// namespace-grouped rule configs alongside the FNV-1a hash of the raw response
// body (for cross-tick dedup by the sync worker).
//
// A 404 is treated as "no rules configured" and yields an empty RulerConfig
// with a nil error — a real ruler with no rule groups is valid. A non-2xx that
// isn't 404, or a 200 whose body does not parse, yields ErrNotARuler so callers
// can reject/flag a datasource that isn't a ruler.
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
