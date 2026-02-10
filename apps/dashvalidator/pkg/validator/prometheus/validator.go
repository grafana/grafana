package prometheus

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// parserLike defines minimal interface for dependency injection
type parserLike interface {
	ExtractMetrics(queryText string) ([]string, error)
}

// Validator implements validator.DatasourceValidator for Prometheus datasources
type Validator struct {
	parser parserLike
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

// ValidateQueries validates Prometheus queries against the datasource
func (v *Validator) ValidateQueries(ctx context.Context, queries []validator.Query, datasource validator.Datasource) (*validator.ValidationResult, error) {
	result := &validator.ValidationResult{
		TotalQueries:   len(queries),
		QueryBreakdown: make([]validator.QueryResult, 0, len(queries)),
	}

	// Step 1: Parse all queries to extract metrics
	// Track all parse results (success or failure) so we can include errors in breakdown
	type queryParseResult struct {
		metrics    []string
		parseError error
	}
	parseResults := make([]queryParseResult, len(queries))
	allMetrics := make(map[string]bool) // Use map to deduplicate
	queryMetrics := make(map[int][]string)

	for i, query := range queries {
		metrics, err := v.parser.ExtractMetrics(query.QueryText)

		// Store result regardless of success/failure
		parseResults[i] = queryParseResult{
			metrics:    metrics,
			parseError: err,
		}

		if err != nil {
			// Don't continue - we'll include this in breakdown as a failed query
		} else {
			result.CheckedQueries++
			queryMetrics[i] = metrics

			// Add to global metrics set
			for _, metric := range metrics {
				allMetrics[metric] = true
			}
		}
	}

	// Convert map to slice for fetcher
	metricsToCheck := make([]string, 0, len(allMetrics))
	for metric := range allMetrics {
		metricsToCheck = append(metricsToCheck, metric)
	}
	result.TotalMetrics = len(metricsToCheck)

	// Step 2: Fetch available metrics from Prometheus (via cache)
	availableMetrics, err := v.cache.GetMetrics(ctx, datasources.DS_PROMETHEUS, datasource.UID, datasource.URL, datasource.HTTPClient)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch metrics from Prometheus: %w", err)
	}

	// Build a set for O(1) lookup
	availableSet := make(map[string]bool)
	for _, metric := range availableMetrics {
		availableSet[metric] = true
	}

	// Step 3: Calculate compatibility
	missingMetricsMap := make(map[string]bool)
	for _, metric := range metricsToCheck {
		if !availableSet[metric] {
			missingMetricsMap[metric] = true
		}
	}
	result.FoundMetrics = result.TotalMetrics - len(missingMetricsMap)

	// Convert missing metrics map to slice
	result.MissingMetrics = make([]string, 0, len(missingMetricsMap))
	for metric := range missingMetricsMap {
		result.MissingMetrics = append(result.MissingMetrics, metric)
	}

	// Step 4: Build per-query breakdown (including queries that failed to parse)
	for i, query := range queries {
		parseResult := parseResults[i]

		queryResult := validator.QueryResult{
			PanelTitle: query.PanelTitle,
			PanelID:    query.PanelID,
			QueryRefID: query.RefID,
		}

		// Check if parsing failed
		if parseResult.parseError != nil {
			// Query failed to parse - treat as 0% compatible
			errMsg := parseResult.parseError.Error()
			queryResult.ParseError = &errMsg
			queryResult.TotalMetrics = 0
			queryResult.FoundMetrics = 0
			queryResult.MissingMetrics = []string{}
			queryResult.CompatibilityScore = 0.0

			result.QueryBreakdown = append(result.QueryBreakdown, queryResult)
			continue
		}

		// Query parsed successfully - proceed with normal validation
		metrics := parseResult.metrics
		queryResult.TotalMetrics = len(metrics)

		// Check which metrics from this query are missing
		queryMissing := make([]string, 0)
		for _, metric := range metrics {
			if missingMetricsMap[metric] {
				queryMissing = append(queryMissing, metric)
			}
		}

		queryResult.MissingMetrics = queryMissing
		queryResult.FoundMetrics = queryResult.TotalMetrics - len(queryMissing)

		// Calculate query-level compatibility score
		if queryResult.TotalMetrics > 0 {
			queryResult.CompatibilityScore = float64(queryResult.FoundMetrics) / float64(queryResult.TotalMetrics)
		} else {
			queryResult.CompatibilityScore = 1.0 // No metrics = perfect compatibility
		}

		result.QueryBreakdown = append(result.QueryBreakdown, queryResult)
	}

	// Step 5: Calculate overall compatibility score
	if result.TotalMetrics > 0 {
		result.CompatibilityScore = float64(result.FoundMetrics) / float64(result.TotalMetrics)
	} else if result.TotalQueries == 0 {
		// No queries at all - nothing to validate, treat as 100% compatible
		result.CompatibilityScore = 1.0
	} else if result.CheckedQueries > 0 {
		// All queries parsed but extracted no metrics (e.g., time() or pure math expressions)
		// This is valid - treat as 100% compatible
		result.CompatibilityScore = 1.0
	} else {
		// All queries failed to parse - treat as 0% compatible
		result.CompatibilityScore = 0.0
	}

	return result, nil
}
