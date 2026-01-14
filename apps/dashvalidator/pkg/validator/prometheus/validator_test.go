package prometheus

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Mock Implementations for Testing
// ============================================================================

// mockParser implements parserLike for testing
type mockParser struct {
	metricsToReturn map[string][]string // queryText -> metrics
	errorToReturn   map[string]error    // queryText -> error
}

func (m *mockParser) ExtractMetrics(queryText string) ([]string, error) {
	if err, ok := m.errorToReturn[queryText]; ok {
		return nil, err
	}
	if metrics, ok := m.metricsToReturn[queryText]; ok {
		return metrics, nil
	}
	return []string{}, nil
}

// mockFetcher implements fetcherLike for testing
type mockFetcher struct {
	metricsToReturn []string
	errorToReturn   error
	callCount       int
}

func (m *mockFetcher) FetchMetrics(ctx context.Context, datasourceURL string, client *http.Client) ([]string, error) {
	m.callCount++
	if m.errorToReturn != nil {
		return nil, m.errorToReturn
	}
	return m.metricsToReturn, nil
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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "process_cpu_seconds_total"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	require.Equal(t, 1, mockFet.callCount)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "http_requests_total", "process_cpu_seconds_total"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "other_metric"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"metric_a"}, // metric_b is missing
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"metric_a"}, // Only metric_a available
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"http_requests_total", "other_metric"}, // http_requests_failed missing
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"other_metric"}, // missing_metric not available
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{}, // Empty Prometheus - no metrics available
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "metric_a"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "metric_a"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "metric_a"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "metric_a"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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

	// Verify - no queries checked, score defaults to 1.0
	require.NoError(t, err) // Parser errors don't fail validation
	require.Equal(t, 2, result.TotalQueries)
	require.Equal(t, 0, result.CheckedQueries) // None successfully parsed
	require.Equal(t, 0, result.TotalMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.Empty(t, result.QueryBreakdown) // No successfully parsed queries
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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up", "metric_a"},
	}

	v := newValidatorForTest(mockPar, mockFet)

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

	// Verify - only successful query counted
	require.NoError(t, err)
	require.Equal(t, 2, result.TotalQueries)
	require.Equal(t, 1, result.CheckedQueries) // Only 1 parsed successfully
	require.Equal(t, 1, result.TotalMetrics)
	require.Equal(t, 1, result.FoundMetrics)
	require.InDelta(t, 1.0, result.CompatibilityScore, 0.001)
	require.Len(t, result.QueryBreakdown, 1) // Only successful query in breakdown
	require.Equal(t, "A", result.QueryBreakdown[0].QueryRefID)
}

// ============================================================================
// Category 5: Error Handling
// ============================================================================

func TestValidateQueries_ParserError_ValidationContinues(t *testing.T) {
	// Already tested in TestValidateQueries_AllQueriesFailToParse
	// and TestValidateQueries_SomeQueriesParse_SomeFail
	// Parser errors are gracefully handled - validation continues
}

func TestValidateQueries_FetcherError_NetworkFailure(t *testing.T) {
	// Setup mocks - fetcher returns error
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	networkErr := errors.New("connection refused")
	mockFet := &mockFetcher{
		errorToReturn: networkErr,
	}

	v := newValidatorForTest(mockPar, mockFet)

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

	// Verify - fetcher error causes validation to fail
	require.Error(t, err)
	require.Nil(t, result)
	require.ErrorContains(t, err, "failed to fetch metrics from Prometheus")
	require.ErrorContains(t, err, "connection refused")
}

func TestValidateQueries_FetcherError_AuthFailure(t *testing.T) {
	// Setup mocks - fetcher returns auth error
	mockPar := &mockParser{
		metricsToReturn: map[string][]string{
			"up": {"up"},
		},
	}
	authErr := fmt.Errorf("HTTP 401: Unauthorized")
	mockFet := &mockFetcher{
		errorToReturn: authErr,
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		errorToReturn: context.Canceled,
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"metric_a", "metric_c"}, // metric_b missing
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"metric_a"}, // Only metric_a available
	}

	v := newValidatorForTest(mockPar, mockFet)

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
	mockFet := &mockFetcher{
		metricsToReturn: []string{"up"}, // metric_a missing
	}

	v := newValidatorForTest(mockPar, mockFet)

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
