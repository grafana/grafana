package prometheus

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Mock Implementations for Testing
// ============================================================================

// mockParser implements validator.MetricExtractor for testing
type mockParser struct {
	metricsToReturn map[string][]string // queryText -> metrics
	errorToReturn   map[string]error    // queryText -> error
}

// Compile-time check that mock implements the interface
var _ validator.MetricExtractor = (*mockParser)(nil)

func (m *mockParser) ExtractMetrics(queryText string) ([]string, error) {
	if err, ok := m.errorToReturn[queryText]; ok {
		return nil, err
	}
	if metrics, ok := m.metricsToReturn[queryText]; ok {
		return metrics, nil
	}
	return []string{}, nil
}

// mockProvider implements cache.MetricsProvider for testing
type mockProvider struct {
	metricsToReturn []string
	ttl             time.Duration
	errorToReturn   error
	callCount       int
}

func (m *mockProvider) GetMetrics(ctx context.Context, datasourceUID, datasourceURL string,
	client *http.Client) (*cache.MetricsResult, error) {
	m.callCount++
	if m.errorToReturn != nil {
		return nil, m.errorToReturn
	}
	return &cache.MetricsResult{
		Metrics: m.metricsToReturn,
		TTL:     m.ttl,
	}, nil
}

// newTestValidator creates a validator with mock parser and mock provider wrapped in real cache.
// It creates a fresh MetricsCache and registers the mock provider for "prometheus" type.
// This is a test-only helper - production code uses NewValidator() which creates the real parser.
func newTestValidator(mockPar validator.MetricExtractor, mockProv *mockProvider) *Validator {
	metricsCache := cache.NewMetricsCache()
	metricsCache.RegisterProvider("prometheus", mockProv)
	return &Validator{
		parser: mockPar,
		cache:  metricsCache,
	}
}

// ============================================================================
// Category 1: Happy Path - All Metrics Found
// ============================================================================

func TestValidateQueries_SingleQuerySingleMetric_AllFound(t *testing.T) {
	// Setup mocks
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "process_cpu_seconds_total"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	// Test data
	queries := []validator.Query{
		{
			RefID:      "A",
			QueryText:  "up",
			PanelTitle: "Service Status",
			PanelID:    1,
		},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		Name:       "Prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, 1, result.TotalQueries)
	require.Equal(t, 1, result.CheckedQueries)
	require.Equal(t, 1, result.TotalMetrics)
	require.Equal(t, 1, result.FoundMetrics)
	require.Empty(t, result.MissingMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.Len(t, result.QueryBreakdown, 1)
	require.Equal(t, 1, mockProv.callCount)

	// Verify query breakdown
	qr := result.QueryBreakdown[0]
	require.Equal(t, "Service Status", qr.PanelTitle)
	require.Equal(t, 1, qr.PanelID)
	require.Equal(t, "A", qr.QueryRefID)
	require.Equal(t, 1, qr.TotalMetrics)
	require.Equal(t, 1, qr.FoundMetrics)
	require.Empty(t, qr.MissingMetrics)
	require.InDelta(t, 1.0, qr.CompatibilityScore, 0.001)
}

func TestValidateQueries_MultipleQueriesMultipleMetrics_AllFound(t *testing.T) {
	// Setup mocks
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up":                            {"up"},
			"rate(http_requests_total[5m])": {"http_requests_total"},
			"process_cpu_seconds_total":     {"process_cpu_seconds_total"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "http_requests_total", "process_cpu_seconds_total"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	// Test data
	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status", PanelID: 1},
		{RefID: "B", QueryText: "rate(http_requests_total[5m])", PanelTitle: "Request Rate", PanelID: 2},
		{RefID: "C", QueryText: "process_cpu_seconds_total", PanelTitle: "CPU", PanelID: 3},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		Name:       "Prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify
	require.NoError(t, err)
	require.Equal(t, 3, result.TotalQueries)
	require.Equal(t, 3, result.CheckedQueries)
	require.Equal(t, 3, result.TotalMetrics)
	require.Equal(t, 3, result.FoundMetrics)
	require.Empty(t, result.MissingMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.Len(t, result.QueryBreakdown, 3)

	// Verify all query breakdowns have score = 1.0
	for _, qr := range result.QueryBreakdown {
		require.InDelta(t, 1.0, qr.CompatibilityScore, 0.001)
		require.Empty(t, qr.MissingMetrics)
	}
}

func TestValidateQueries_DuplicateMetricsAcrossQueries_Deduplication(t *testing.T) {
	// Setup mocks - both queries use same metric
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up":      {"up"},
			"sum(up)": {"up"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "other_metric"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	// Test data - both queries reference "up" metric
	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status", PanelID: 1},
		{RefID: "B", QueryText: "sum(up)", PanelTitle: "Total Status", PanelID: 2},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - should deduplicate "up" metric
	require.NoError(t, err)
	require.Equal(t, 2, result.TotalQueries)
	require.Equal(t, 2, result.CheckedQueries)
	require.Equal(t, 1, result.TotalMetrics) // Deduped: only 1 unique metric
	require.Equal(t, 1, result.FoundMetrics)
	require.Empty(t, result.MissingMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.Len(t, result.QueryBreakdown, 2)
}

// ============================================================================
// Category 2: Partial Compatibility
// ============================================================================

func TestValidateQueries_SingleQuery_HalfMetricsMissing(t *testing.T) {
	// Setup mocks - query has 2 metrics, only 1 available
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"metric_a / metric_b": {"metric_a", "metric_b"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"metric_a"}, // metric_b is missing
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "metric_a / metric_b", PanelTitle: "Ratio", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - 50% compatibility
	require.NoError(t, err)
	require.Equal(t, 1, result.TotalQueries)
	require.Equal(t, 1, result.CheckedQueries)
	require.Equal(t, 2, result.TotalMetrics)
	require.Equal(t, 1, result.FoundMetrics)
	require.Len(t, result.MissingMetrics, 1)
	require.Contains(t, result.MissingMetrics, "metric_b")
	require.InDelta(t, 0.5, result.CompatibilityScore, 0.001)

	// Verify query breakdown
	qr := result.QueryBreakdown[0]
	require.Equal(t, 2, qr.TotalMetrics)
	require.Equal(t, 1, qr.FoundMetrics)
	require.Len(t, qr.MissingMetrics, 1)
	require.Contains(t, qr.MissingMetrics, "metric_b")
	require.InDelta(t, 0.5, qr.CompatibilityScore, 0.001)
}

func TestValidateQueries_MultipleQueries_VaryingCompatibility(t *testing.T) {
	// Setup mocks - different compatibility per query
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"metric_a":            {"metric_a"},             // Will be found
			"metric_b":            {"metric_b"},             // Will be missing
			"metric_c + metric_d": {"metric_c", "metric_d"}, // Both missing
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"metric_a"}, // Only metric_a available
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "metric_a", PanelTitle: "Panel A", PanelID: 1},
		{RefID: "B", QueryText: "metric_b", PanelTitle: "Panel B", PanelID: 2},
		{RefID: "C", QueryText: "metric_c + metric_d", PanelTitle: "Panel C", PanelID: 3},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify overall results
	require.NoError(t, err)
	require.Equal(t, 3, result.TotalQueries)
	require.Equal(t, 3, result.CheckedQueries)
	require.Equal(t, 4, result.TotalMetrics) // 4 unique metrics: metric_a, metric_b, metric_c, metric_d
	require.Equal(t, 1, result.FoundMetrics) // Only metric_a found
	require.ElementsMatch(t, []string{"metric_b", "metric_c", "metric_d"}, result.MissingMetrics)
	require.InDelta(t, 1.0/4.0, result.CompatibilityScore, 0.001) // 1/4 = 0.25

	// Verify per-query breakdown
	require.Len(t, result.QueryBreakdown, 3)

	// Query A: 100% compatible
	require.InDelta(t, 1.0, result.QueryBreakdown[0].CompatibilityScore, 0.001)
	require.Empty(t, result.QueryBreakdown[0].MissingMetrics)

	// Query B: 0% compatible
	require.InDelta(t, 0.0, result.QueryBreakdown[1].CompatibilityScore, 0.001)
	require.Contains(t, result.QueryBreakdown[1].MissingMetrics, "metric_b")

	// Query C: 0% compatible
	require.InDelta(t, 0.0, result.QueryBreakdown[2].CompatibilityScore, 0.001)
	require.ElementsMatch(t, []string{"metric_c", "metric_d"}, result.QueryBreakdown[2].MissingMetrics)
}

func TestValidateQueries_ComplexPromQL_SomeMissing(t *testing.T) {
	// Setup mocks - complex query with multiple metrics
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"sum(rate(http_requests_total[5m])) / sum(rate(http_requests_failed[5m]))": {
				"http_requests_total",
				"http_requests_failed",
			},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"http_requests_total", "other_metric"}, // http_requests_failed missing
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{
			RefID:      "A",
			QueryText:  "sum(rate(http_requests_total[5m])) / sum(rate(http_requests_failed[5m]))",
			PanelTitle: "Error Rate",
			PanelID:    1,
		},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - 50% compatibility
	require.NoError(t, err)
	require.Equal(t, 2, result.TotalMetrics)
	require.Equal(t, 1, result.FoundMetrics)
	require.Len(t, result.MissingMetrics, 1)
	require.Contains(t, result.MissingMetrics, "http_requests_failed")
	require.InDelta(t, 0.5, result.CompatibilityScore, 0.001)
}

// ============================================================================
// Category 3: No Compatibility
// ============================================================================

func TestValidateQueries_SingleQuery_AllMetricsMissing(t *testing.T) {
	// Setup mocks - metric not available
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"missing_metric": {"missing_metric"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"other_metric"}, // missing_metric not available
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "missing_metric", PanelTitle: "Panel", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - 0% compatibility
	require.NoError(t, err)
	require.Equal(t, 1, result.TotalMetrics)
	require.Equal(t, 0, result.FoundMetrics)
	require.Len(t, result.MissingMetrics, 1)
	require.Contains(t, result.MissingMetrics, "missing_metric")
	require.InDelta(t, 0.0, result.CompatibilityScore, 0.001)

	// Verify query breakdown
	qr := result.QueryBreakdown[0]
	require.InDelta(t, 0.0, qr.CompatibilityScore, 0.001)
	require.Len(t, qr.MissingMetrics, 1)
	require.Contains(t, qr.MissingMetrics, "missing_metric")
}

func TestValidateQueries_MultipleQueries_NoMetricsFound(t *testing.T) {
	// Setup mocks - no metrics available
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"metric_a": {"metric_a"},
			"metric_b": {"metric_b"},
			"metric_c": {"metric_c"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{}, // Empty Prometheus - no metrics available
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "metric_a", PanelTitle: "Panel A", PanelID: 1},
		{RefID: "B", QueryText: "metric_b", PanelTitle: "Panel B", PanelID: 2},
		{RefID: "C", QueryText: "metric_c", PanelTitle: "Panel C", PanelID: 3},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - 0% compatibility
	require.NoError(t, err)
	require.Equal(t, 3, result.TotalMetrics)
	require.Equal(t, 0, result.FoundMetrics)
	require.ElementsMatch(t, []string{"metric_a", "metric_b", "metric_c"}, result.MissingMetrics)
	require.InDelta(t, 0.0, result.CompatibilityScore, 0.001)

	// All query breakdowns should have 0% compatibility
	for _, qr := range result.QueryBreakdown {
		require.InDelta(t, 0.0, qr.CompatibilityScore, 0.001)
		require.NotEmpty(t, qr.MissingMetrics)
	}
}

// ============================================================================
// Category 4: Edge Cases
// ============================================================================

func TestValidateQueries_EmptyQueryList(t *testing.T) {
	// Setup mocks
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "metric_a"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{} // Empty query list
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - no queries, score defaults to 1.0
	require.NoError(t, err)
	require.Equal(t, 0, result.TotalQueries)
	require.Equal(t, 0, result.CheckedQueries)
	require.Equal(t, 0, result.TotalMetrics)
	require.Equal(t, 0, result.FoundMetrics)
	require.Empty(t, result.MissingMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001) // Default: 1.0 when no metrics
	require.Empty(t, result.QueryBreakdown)
}

func TestValidateQueries_QueryWithNoMetrics_TimeFunction(t *testing.T) {
	// Setup mocks - time() returns no metrics
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"time()": {}, // No metrics in this query
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "metric_a"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "time()", PanelTitle: "Current Time", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - no metrics = perfect compatibility (by design)
	require.NoError(t, err)
	require.Equal(t, 1, result.TotalQueries)
	require.Equal(t, 1, result.CheckedQueries)
	require.Equal(t, 0, result.TotalMetrics)
	require.Equal(t, 0, result.FoundMetrics)
	require.Empty(t, result.MissingMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001) // No metrics = 1.0

	// Verify query breakdown
	qr := result.QueryBreakdown[0]
	require.Equal(t, 0, qr.TotalMetrics)
	require.Equal(t, 0, qr.FoundMetrics)
	require.Empty(t, qr.MissingMetrics)
	require.InDelta(t, 1.0, qr.CompatibilityScore, 0.001) // No metrics = 1.0
}

func TestValidateQueries_QueryWithNoMetrics_MathExpression(t *testing.T) {
	// Setup mocks - mathematical constant expression
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"1 + 1": {}, // No metrics in pure math
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "metric_a"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "1 + 1", PanelTitle: "Constant", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - no metrics = perfect compatibility
	require.NoError(t, err)
	require.Equal(t, 1, result.TotalQueries)
	require.Equal(t, 1, result.CheckedQueries)
	require.Equal(t, 0, result.TotalMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.InDelta(t, 1.0, result.QueryBreakdown[0].CompatibilityScore, 0.001)
}

func TestValidateQueries_AllQueriesFailToParse(t *testing.T) {
	// Setup mocks - all queries fail to parse
	parseErr := errors.New("invalid PromQL syntax")
	mockPar := &mockParser{
		errorToReturn: map[string]error{
			"invalid{{}": parseErr,
			"bad syntax": parseErr,
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "metric_a"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "invalid{{}", PanelTitle: "Bad Query 1", PanelID: 1},
		{RefID: "B", QueryText: "bad syntax", PanelTitle: "Bad Query 2", PanelID: 2},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - no queries checked, score is 0% (not 1.0!)
	require.NoError(t, err) // Parser errors don't fail validation
	require.Equal(t, 2, result.TotalQueries)
	require.Equal(t, 0, result.CheckedQueries) // None successfully parsed
	require.Equal(t, 0, result.TotalMetrics)
	require.InDelta(t, 0.0, result.CompatibilityScore, 0.001) // Bug fix: was 1.0, now 0.0
	require.Len(t, result.QueryBreakdown, 2)                  // Failed queries now included

	// Verify first failed query
	qr1 := result.QueryBreakdown[0]
	require.Equal(t, "Bad Query 1", qr1.PanelTitle)
	require.Equal(t, "A", qr1.QueryRefID)
	require.NotNil(t, qr1.ParseError)
	require.Contains(t, *qr1.ParseError, "invalid PromQL syntax")
	require.Equal(t, 0, qr1.TotalMetrics)
	require.InDelta(t, 0.0, qr1.CompatibilityScore, 0.001)

	// Verify second failed query
	qr2 := result.QueryBreakdown[1]
	require.Equal(t, "Bad Query 2", qr2.PanelTitle)
	require.Equal(t, "B", qr2.QueryRefID)
	require.NotNil(t, qr2.ParseError)
	require.Contains(t, *qr2.ParseError, "invalid PromQL syntax")
	require.InDelta(t, 0.0, qr2.CompatibilityScore, 0.001)
}

func TestValidateQueries_SomeQueriesParse_SomeFail(t *testing.T) {
	// Setup mocks - mixed success/failure
	parseErr := errors.New("invalid PromQL syntax")
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
		errorToReturn: map[string]error{
			"invalid{{}": parseErr,
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up", "metric_a"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Good Query", PanelID: 1},
		{RefID: "B", QueryText: "invalid{{}", PanelTitle: "Bad Query", PanelID: 2},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - only successful query counted for metrics, but both in breakdown
	require.NoError(t, err)
	require.Equal(t, 2, result.TotalQueries)
	require.Equal(t, 1, result.CheckedQueries) // Only 1 parsed successfully
	require.Equal(t, 1, result.TotalMetrics)
	require.Equal(t, 1, result.FoundMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.Len(t, result.QueryBreakdown, 2) // Both queries in breakdown now

	// Verify successful query
	qr1 := result.QueryBreakdown[0]
	require.Equal(t, "A", qr1.QueryRefID)
	require.Equal(t, "Good Query", qr1.PanelTitle)
	require.Nil(t, qr1.ParseError)
	require.Equal(t, 1, qr1.TotalMetrics)
	require.InDelta(t, 1.0, qr1.CompatibilityScore, 0.001)

	// Verify failed query has parse error
	qr2 := result.QueryBreakdown[1]
	require.Equal(t, "B", qr2.QueryRefID)
	require.Equal(t, "Bad Query", qr2.PanelTitle)
	require.NotNil(t, qr2.ParseError)
	require.Contains(t, *qr2.ParseError, "invalid PromQL syntax")
	require.Equal(t, 0, qr2.TotalMetrics)
	require.InDelta(t, 0.0, qr2.CompatibilityScore, 0.001)
}

// ============================================================================
// Category 5: Error Handling
// ============================================================================

func TestValidateQueries_ParserError_ValidationContinues(t *testing.T) {
	// Already tested in TestValidateQueries_AllQueriesFailToParse
	// and TestValidateQueries_SomeQueriesParse_SomeFail
	// Parser errors are gracefully handled - validation continues
}

func TestValidateQueries_ProviderError_NetworkFailure(t *testing.T) {
	// Setup mocks - provider returns error
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	networkErr := errors.New("connection refused")
	mockProv := &mockProvider{
		errorToReturn: networkErr,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - provider error causes validation to fail
	require.Error(t, err)
	require.Nil(t, result)
	require.ErrorContains(t, err, "failed to fetch metrics from Prometheus")
	require.ErrorContains(t, err, "connection refused")
}

func TestValidateQueries_ProviderError_AuthFailure(t *testing.T) {
	// Setup mocks - provider returns auth error
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	authErr := fmt.Errorf("HTTP 401: Unauthorized")
	mockProv := &mockProvider{
		errorToReturn: authErr,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify - auth error causes validation to fail
	require.Error(t, err)
	require.Nil(t, result)
	require.ErrorContains(t, err, "failed to fetch metrics from Prometheus")
	require.ErrorContains(t, err, "401")
}

func TestValidateQueries_ContextCancellation(t *testing.T) {
	// Setup mocks
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	mockProv := &mockProvider{
		errorToReturn: context.Canceled,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Create cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	// Execute
	result, err := v.ValidateQueries(ctx, queries, datasource)

	// Verify - context cancellation causes failure
	require.Error(t, err)
	require.Nil(t, result)
	require.ErrorIs(t, err, context.Canceled)
}

// ============================================================================
// Category 6: Calculation Validation
// ============================================================================

func TestValidateQueries_FoundMetricsCalculation(t *testing.T) {
	// Setup mocks - verify calculation: FoundMetrics = TotalMetrics - len(MissingMetrics)
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"query1": {"metric_a", "metric_b", "metric_c"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"metric_a", "metric_c"}, // metric_b missing
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "query1", PanelTitle: "Test", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify calculation
	require.NoError(t, err)
	require.Equal(t, 3, result.TotalMetrics)
	require.Equal(t, 2, result.FoundMetrics) // 3 - 1 = 2
	require.Len(t, result.MissingMetrics, 1)
	require.Contains(t, result.MissingMetrics, "metric_b")

	// Verify formula: FoundMetrics / TotalMetrics = 2/3
	expectedScore := 2.0 / 3.0
	require.InDelta(t, expectedScore, result.CompatibilityScore, 0.001)
}

func TestValidateQueries_MissingMetricsList(t *testing.T) {
	// Setup mocks - verify missing metrics list is accurate
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"query1": {"metric_a"},
			"query2": {"metric_b", "metric_c"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"metric_a"}, // Only metric_a available
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "query1", PanelTitle: "Panel A", PanelID: 1},
		{RefID: "B", QueryText: "query2", PanelTitle: "Panel B", PanelID: 2},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify missing metrics list
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"metric_b", "metric_c"}, result.MissingMetrics)

	// Verify per-query missing metrics
	require.Empty(t, result.QueryBreakdown[0].MissingMetrics) // Query A has no missing
	require.ElementsMatch(t, []string{"metric_b", "metric_c"}, result.QueryBreakdown[1].MissingMetrics)
}

func TestValidateQueries_QueryBreakdownStructure(t *testing.T) {
	// Setup mocks - verify QueryBreakdown structure is complete
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up":       {"up"},
			"metric_a": {"metric_a"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up"}, // metric_a missing
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status Check", PanelID: 1},
		{RefID: "B", QueryText: "metric_a", PanelTitle: "Metric A", PanelID: 2},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// Execute
	result, err := v.ValidateQueries(context.Background(), queries, datasource)

	// Verify QueryBreakdown structure
	require.NoError(t, err)
	require.Len(t, result.QueryBreakdown, 2)

	// Verify first query breakdown
	qr1 := result.QueryBreakdown[0]
	require.Equal(t, "Status Check", qr1.PanelTitle)
	require.Equal(t, 1, qr1.PanelID)
	require.Equal(t, "A", qr1.QueryRefID)
	require.Equal(t, 1, qr1.TotalMetrics)
	require.Equal(t, 1, qr1.FoundMetrics)
	require.Empty(t, qr1.MissingMetrics)
	require.InDelta(t, 1.0, qr1.CompatibilityScore, 0.001)

	// Verify second query breakdown
	qr2 := result.QueryBreakdown[1]
	require.Equal(t, "Metric A", qr2.PanelTitle)
	require.Equal(t, 2, qr2.PanelID)
	require.Equal(t, "B", qr2.QueryRefID)
	require.Equal(t, 1, qr2.TotalMetrics)
	require.Equal(t, 0, qr2.FoundMetrics)
	require.Contains(t, qr2.MissingMetrics, "metric_a")
	require.InDelta(t, 0.0, qr2.CompatibilityScore, 0.001)
}

// ============================================================================
// Category 7: Cache Behavior
// ============================================================================

func TestValidateQueries_CacheHit_NoProviderCallOnSecondValidation(t *testing.T) {
	// Setup mocks
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	mockProv := &mockProvider{
		metricsToReturn: []string{"up"},
		ttl:             5 * time.Minute,
	}

	v := newTestValidator(mockPar, mockProv)

	queries := []validator.Query{
		{RefID: "A", QueryText: "up", PanelTitle: "Status", PanelID: 1},
	}
	datasource := validator.Datasource{
		UID:        "prom-uid",
		Type:       "prometheus",
		URL:        "http://localhost:9090",
		HTTPClient: &http.Client{},
	}

	// First validation - cache miss
	_, err := v.ValidateQueries(context.Background(), queries, datasource)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.callCount) // Provider called once

	// Second validation - cache hit
	_, err = v.ValidateQueries(context.Background(), queries, datasource)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.callCount) // Provider NOT called again
}

// ============================================================================
// Unit Tests for Helper Functions
// ============================================================================

func TestCalculateOverallScore(t *testing.T) {
	tests := []struct {
		name           string
		totalQueries   int
		checkedQueries int
		totalMetrics   int
		foundMetrics   int
		expected       float64
	}{
		{
			name:           "normal case - all found",
			totalQueries:   3,
			checkedQueries: 3,
			totalMetrics:   5,
			foundMetrics:   5,
			expected:       1.0,
		},
		{
			name:           "normal case - partial",
			totalQueries:   2,
			checkedQueries: 2,
			totalMetrics:   4,
			foundMetrics:   2,
			expected:       0.5,
		},
		{
			name:           "normal case - none found",
			totalQueries:   1,
			checkedQueries: 1,
			totalMetrics:   3,
			foundMetrics:   0,
			expected:       0.0,
		},
		{
			name:           "no queries - empty dashboard",
			totalQueries:   0,
			checkedQueries: 0,
			totalMetrics:   0,
			foundMetrics:   0,
			expected:       1.0,
		},
		{
			name:           "queries parsed but no metrics extracted - time()",
			totalQueries:   1,
			checkedQueries: 1,
			totalMetrics:   0,
			foundMetrics:   0,
			expected:       1.0,
		},
		{
			name:           "all queries failed to parse",
			totalQueries:   2,
			checkedQueries: 0,
			totalMetrics:   0,
			foundMetrics:   0,
			expected:       0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := calculateOverallScore(tt.totalQueries, tt.checkedQueries, tt.totalMetrics, tt.foundMetrics)
			require.InDelta(t, tt.expected, score, 0.001)
		})
	}
}

func TestCalculateCompatibility(t *testing.T) {
	tests := []struct {
		name             string
		uniqueMetrics    []string
		availableSet     map[string]bool
		expectedFound    int
		expectedMissing  []string
		expectedMissingN int // length check when order doesn't matter
	}{
		{
			name:             "all metrics found",
			uniqueMetrics:    []string{"up", "cpu"},
			availableSet:     map[string]bool{"up": true, "cpu": true, "mem": true},
			expectedFound:    2,
			expectedMissingN: 0,
		},
		{
			name:             "no metrics found",
			uniqueMetrics:    []string{"up", "cpu"},
			availableSet:     map[string]bool{"mem": true},
			expectedFound:    0,
			expectedMissingN: 2,
		},
		{
			name:             "partial - one missing",
			uniqueMetrics:    []string{"up", "cpu"},
			availableSet:     map[string]bool{"up": true},
			expectedFound:    1,
			expectedMissing:  []string{"cpu"},
			expectedMissingN: 1,
		},
		{
			name:             "empty metrics list",
			uniqueMetrics:    []string{},
			availableSet:     map[string]bool{"up": true},
			expectedFound:    0,
			expectedMissingN: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			foundCount, missingMetrics, missingSet := calculateCompatibility(tt.uniqueMetrics, tt.availableSet)
			require.Equal(t, tt.expectedFound, foundCount)
			require.Len(t, missingMetrics, tt.expectedMissingN)
			require.Len(t, missingSet, tt.expectedMissingN)
			if tt.expectedMissing != nil {
				require.ElementsMatch(t, tt.expectedMissing, missingMetrics)
			}
		})
	}
}

func TestParseQueries(t *testing.T) {
	t.Run("all successful", func(t *testing.T) {
		parser := &mockParser{
			metricsToReturn: map[string][]string{
				"up":       {"up"},
				"sum(cpu)": {"cpu"},
			},
		}
		queries := []validator.Query{
			{RefID: "A", QueryText: "up"},
			{RefID: "B", QueryText: "sum(cpu)"},
		}

		parseResults, uniqueMetrics, checkedCount := parseQueries(queries, parser)

		require.Len(t, parseResults, 2)
		require.Equal(t, 2, checkedCount)
		require.ElementsMatch(t, []string{"up", "cpu"}, uniqueMetrics)
		require.Nil(t, parseResults[0].parseError)
		require.Nil(t, parseResults[1].parseError)
	})

	t.Run("all failed", func(t *testing.T) {
		parseErr := errors.New("bad syntax")
		parser := &mockParser{
			errorToReturn: map[string]error{
				"bad1": parseErr,
				"bad2": parseErr,
			},
		}
		queries := []validator.Query{
			{RefID: "A", QueryText: "bad1"},
			{RefID: "B", QueryText: "bad2"},
		}

		parseResults, uniqueMetrics, checkedCount := parseQueries(queries, parser)

		require.Len(t, parseResults, 2)
		require.Equal(t, 0, checkedCount)
		require.Empty(t, uniqueMetrics)
		require.Error(t, parseResults[0].parseError)
		require.Error(t, parseResults[1].parseError)
	})

	t.Run("mixed success and failure", func(t *testing.T) {
		parser := &mockParser{
			metricsToReturn: map[string][]string{
				"up": {"up"},
			},
			errorToReturn: map[string]error{
				"bad": errors.New("bad"),
			},
		}
		queries := []validator.Query{
			{RefID: "A", QueryText: "up"},
			{RefID: "B", QueryText: "bad"},
		}

		parseResults, uniqueMetrics, checkedCount := parseQueries(queries, parser)

		require.Len(t, parseResults, 2)
		require.Equal(t, 1, checkedCount)
		require.ElementsMatch(t, []string{"up"}, uniqueMetrics)
		require.Nil(t, parseResults[0].parseError)
		require.Error(t, parseResults[1].parseError)
	})

	t.Run("deduplication across queries", func(t *testing.T) {
		parser := &mockParser{
			metricsToReturn: map[string][]string{
				"up":      {"up"},
				"sum(up)": {"up"},
			},
		}
		queries := []validator.Query{
			{RefID: "A", QueryText: "up"},
			{RefID: "B", QueryText: "sum(up)"},
		}

		_, uniqueMetrics, _ := parseQueries(queries, parser)

		require.Len(t, uniqueMetrics, 1) // "up" deduplicated
		require.Contains(t, uniqueMetrics, "up")
	})

	t.Run("empty queries list", func(t *testing.T) {
		parser := &mockParser{}
		queries := []validator.Query{}

		parseResults, uniqueMetrics, checkedCount := parseQueries(queries, parser)

		require.Empty(t, parseResults)
		require.Empty(t, uniqueMetrics)
		require.Equal(t, 0, checkedCount)
	})
}

func TestBuildQueryBreakdown(t *testing.T) {
	t.Run("all parsed successfully", func(t *testing.T) {
		queries := []validator.Query{
			{RefID: "A", PanelTitle: "Panel A", PanelID: 1},
			{RefID: "B", PanelTitle: "Panel B", PanelID: 2},
		}
		parseResults := []parseQueryResult{
			{metrics: []string{"up"}},
			{metrics: []string{"cpu"}},
		}
		missingSet := map[string]bool{} // nothing missing

		breakdown := buildQueryBreakdown(queries, parseResults, missingSet)

		require.Len(t, breakdown, 2)
		require.InDelta(t, 1.0, breakdown[0].CompatibilityScore, 0.001)
		require.InDelta(t, 1.0, breakdown[1].CompatibilityScore, 0.001)
		require.Nil(t, breakdown[0].ParseError)
	})

	t.Run("with parse errors", func(t *testing.T) {
		queries := []validator.Query{
			{RefID: "A", PanelTitle: "Bad", PanelID: 1},
		}
		parseResults := []parseQueryResult{
			{parseError: errors.New("syntax error")},
		}
		missingSet := map[string]bool{}

		breakdown := buildQueryBreakdown(queries, parseResults, missingSet)

		require.Len(t, breakdown, 1)
		require.NotNil(t, breakdown[0].ParseError)
		require.Contains(t, *breakdown[0].ParseError, "syntax error")
		require.InDelta(t, 0.0, breakdown[0].CompatibilityScore, 0.001)
		require.Equal(t, 0, breakdown[0].TotalMetrics)
	})

	t.Run("mixed compatibility", func(t *testing.T) {
		queries := []validator.Query{
			{RefID: "A", PanelTitle: "Good", PanelID: 1},
			{RefID: "B", PanelTitle: "Half", PanelID: 2},
		}
		parseResults := []parseQueryResult{
			{metrics: []string{"up"}},
			{metrics: []string{"cpu", "mem"}},
		}
		missingSet := map[string]bool{"mem": true}

		breakdown := buildQueryBreakdown(queries, parseResults, missingSet)

		require.Len(t, breakdown, 2)
		require.InDelta(t, 1.0, breakdown[0].CompatibilityScore, 0.001) // up found
		require.InDelta(t, 0.5, breakdown[1].CompatibilityScore, 0.001) // 1/2 found
		require.Contains(t, breakdown[1].MissingMetrics, "mem")
	})

	t.Run("query with no metrics - time()", func(t *testing.T) {
		queries := []validator.Query{
			{RefID: "A", PanelTitle: "Time", PanelID: 1},
		}
		parseResults := []parseQueryResult{
			{metrics: []string{}},
		}
		missingSet := map[string]bool{}

		breakdown := buildQueryBreakdown(queries, parseResults, missingSet)

		require.Len(t, breakdown, 1)
		require.Equal(t, 0, breakdown[0].TotalMetrics)
		require.InDelta(t, 1.0, breakdown[0].CompatibilityScore, 0.001)
	})
}
