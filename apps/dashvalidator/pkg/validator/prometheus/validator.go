package prometheus

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// Validator implements validator.DatasourceValidator for Prometheus datasources
type Validator struct {
	parser validator.MetricExtractor
	cache  *cache.MetricsCache
}

// evaluate at compile time that Validator implements DatasourceValidator interface
var _ validator.DatasourceValidator = (*Validator)(nil)

// NewValidator creates a new Prometheus validator.
// The metricsCache parameter is required - pass nil will cause a panic.
func NewValidator(mc *cache.MetricsCache) *Validator {
	if mc == nil {
		panic("metricsCache cannot be nil")
	}
	return &Validator{
		parser: NewParser(),
		cache:  mc,
	}
}

// ValidateQueries validates Prometheus queries against the datasource.
// It orchestrates parsing, fetching, compatibility checking, and scoring.
func (v *Validator) ValidateQueries(ctx context.Context, queries []validator.Query, datasource validator.Datasource) (*validator.ValidationResult, error) {
	parseResults, uniqueMetrics, checkedCount := parseQueries(queries, v.parser)

	availableSet, err := fetchAvailableMetrics(ctx, v.cache, datasource)
	if err != nil {
		return nil, err
	}

	foundCount, missingMetrics, missingSet := calculateCompatibility(uniqueMetrics, availableSet)

	return &validator.ValidationResult{
		TotalQueries:   len(queries),
		CheckedQueries: checkedCount,
		QueryBreakdown: buildQueryBreakdown(queries, parseResults, missingSet),
		CompatibilityResult: validator.CompatibilityResult{
			TotalMetrics:       len(uniqueMetrics),
			FoundMetrics:       foundCount,
			MissingMetrics:     missingMetrics,
			CompatibilityScore: calculateOverallScore(len(queries), checkedCount, len(uniqueMetrics), foundCount),
		},
	}, nil
}

// fetchAvailableMetrics retrieves available metrics from the datasource via cache
// and returns them as a set for O(1) lookup.
// This is a thin wrapper that delegates to the cache layer.
func fetchAvailableMetrics(ctx context.Context, metricsCache *cache.MetricsCache, datasource validator.Datasource) (map[string]bool, error) {
	availableMetrics, err := metricsCache.GetMetrics(ctx, datasources.DS_PROMETHEUS, datasource.UID, datasource.URL, datasource.HTTPClient)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metrics from Prometheus: %w", err)
	}

	availableSet := make(map[string]bool, len(availableMetrics))
	for _, metric := range availableMetrics {
		availableSet[metric] = true
	}

	return availableSet, nil
}

// parseQueries parses all queries to extract metrics.
// Returns per-query parse results, a deduplicated list of all metrics, and
// the count of successfully parsed queries.
func parseQueries(queries []validator.Query, parser validator.MetricExtractor) ([]parseQueryResult, []string, int) {
	parseResults := make([]parseQueryResult, len(queries))
	allMetrics := make(map[string]bool)
	checkedCount := 0

	for i, query := range queries {
		metrics, err := parser.ExtractMetrics(query.QueryText)

		parseResults[i] = parseQueryResult{
			metrics:    metrics,
			parseError: err,
		}

		if err == nil {
			checkedCount++
			for _, metric := range metrics {
				allMetrics[metric] = true
			}
		}
	}

	uniqueMetrics := make([]string, 0, len(allMetrics))
	for metric := range allMetrics {
		uniqueMetrics = append(uniqueMetrics, metric)
	}

	return parseResults, uniqueMetrics, checkedCount
}

// parseQueryResult holds the outcome of parsing a single query.
type parseQueryResult struct {
	metrics    []string
	parseError error
}

// buildQueryBreakdown creates per-query validation results.
// Queries that failed to parse get 0% score but are still included in the breakdown.
// Queries with no metrics (e.g., time()) get 100% score.
func buildQueryBreakdown(queries []validator.Query, parseResults []parseQueryResult, missingSet map[string]bool) []validator.QueryResult {
	breakdown := make([]validator.QueryResult, 0, len(queries))

	for i, query := range queries {
		parseResult := parseResults[i]

		queryResult := validator.QueryResult{
			PanelTitle: query.PanelTitle,
			PanelID:    query.PanelID,
			QueryRefID: query.RefID,
		}

		if parseResult.parseError != nil {
			errMsg := parseResult.parseError.Error()
			queryResult.ParseError = &errMsg
			queryResult.TotalMetrics = 0
			queryResult.FoundMetrics = 0
			queryResult.MissingMetrics = []string{}
			queryResult.CompatibilityScore = 0.0
			breakdown = append(breakdown, queryResult)
			continue
		}

		metrics := parseResult.metrics
		queryResult.TotalMetrics = len(metrics)

		queryMissing := make([]string, 0)
		for _, metric := range metrics {
			if missingSet[metric] {
				queryMissing = append(queryMissing, metric)
			}
		}

		queryResult.MissingMetrics = queryMissing
		queryResult.FoundMetrics = queryResult.TotalMetrics - len(queryMissing)

		if queryResult.TotalMetrics > 0 {
			queryResult.CompatibilityScore = float64(queryResult.FoundMetrics) / float64(queryResult.TotalMetrics)
		} else {
			queryResult.CompatibilityScore = 1.0
		}

		breakdown = append(breakdown, queryResult)
	}

	return breakdown
}

// calculateCompatibility checks which metrics are available and which are missing.
// Returns the count of found metrics, a slice of missing metric names (for JSON),
// and a set of missing metrics (for O(1) lookup in query breakdown).
func calculateCompatibility(uniqueMetrics []string, availableSet map[string]bool) (foundCount int, missingMetrics []string, missingSet map[string]bool) {
	missingSet = make(map[string]bool)
	for _, metric := range uniqueMetrics {
		if !availableSet[metric] {
			missingSet[metric] = true
		}
	}

	foundCount = len(uniqueMetrics) - len(missingSet)

	missingMetrics = make([]string, 0, len(missingSet))
	for metric := range missingSet {
		missingMetrics = append(missingMetrics, metric)
	}

	return foundCount, missingMetrics, missingSet
}

// calculateOverallScore returns a compatibility score between 0.0 and 1.0.
// When metrics exist, it returns foundMetrics/totalMetrics.
// When no metrics were extracted, it uses totalQueries and checkedQueries
// to distinguish "nothing to validate" (1.0) from "everything broke" (0.0).
func calculateOverallScore(totalQueries, checkedQueries, totalMetrics, foundMetrics int) float64 {
	if totalMetrics > 0 {
		return float64(foundMetrics) / float64(totalMetrics)
	}
	// No metrics to check — distinguish why:
	if totalQueries == 0 {
		return 1.0 // Empty dashboard, nothing can break
	}
	if checkedQueries > 0 {
		return 1.0 // Valid queries like time() or 1+1 that reference no metrics
	}
	return 0.0 // Every query failed to parse, can't verify compatibility
}
