package prometheus

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
)

// Register Prometheus validator on package import
func init() {
	validator.RegisterValidator("prometheus", func() validator.DatasourceValidator {
		return NewValidator()
	})
}

// Validator implements validator.DatasourceValidator for Prometheus datasources
type Validator struct {
	parser  *Parser
	fetcher *Fetcher
}

// NewValidator creates a new Prometheus validator
func NewValidator() validator.DatasourceValidator {
	return &Validator{
		parser:  NewParser(),
		fetcher: NewFetcher(),
	}
}

// ValidateQueries validates Prometheus queries against the datasource
func (v *Validator) ValidateQueries(ctx context.Context, queries []validator.Query, datasource validator.Datasource) (*validator.ValidationResult, error) {
	fmt.Printf("[DEBUG PROM] Starting validation for %d queries against datasource %s\n", len(queries), datasource.URL)

	result := &validator.ValidationResult{
		TotalQueries:   len(queries),
		QueryBreakdown: make([]validator.QueryResult, 0, len(queries)),
	}

	// Step 1: Parse all queries to extract metrics
	allMetrics := make(map[string]bool) // Use map to deduplicate
	queryMetrics := make(map[int][]string)

	for i, query := range queries {
		fmt.Printf("[DEBUG PROM] Parsing query %d: %s\n", i, query.QueryText)
		metrics, err := v.parser.ExtractMetrics(query.QueryText)
		if err != nil {
			// If we can't parse the query, we still continue with others
			// but we don't count this query as "checked"
			fmt.Printf("[DEBUG PROM] Failed to parse query %d: %v\n", i, err)
			continue
		}
		fmt.Printf("[DEBUG PROM] Extracted %d metrics from query %d: %v\n", len(metrics), i, metrics)
		result.CheckedQueries++
		queryMetrics[i] = metrics

		// Add to global metrics set
		for _, metric := range metrics {
			allMetrics[metric] = true
		}
	}

	// Convert map to slice for fetcher
	metricsToCheck := make([]string, 0, len(allMetrics))
	for metric := range allMetrics {
		metricsToCheck = append(metricsToCheck, metric)
	}
	result.TotalMetrics = len(metricsToCheck)

	fmt.Printf("[DEBUG PROM] Total metrics to check: %d - %v\n", len(metricsToCheck), metricsToCheck)

	// Step 2: Fetch available metrics from Prometheus
	fmt.Printf("[DEBUG PROM] Fetching available metrics from %s\n", datasource.URL)
	availableMetrics, err := v.fetcher.FetchMetrics(ctx, datasource.URL, datasource.HTTPClient)
	if err != nil {
		fmt.Printf("[DEBUG PROM] Failed to fetch metrics: %v\n", err)
		return nil, fmt.Errorf("failed to fetch metrics from Prometheus: %w", err)
	}
	fmt.Printf("[DEBUG PROM] Fetched %d available metrics from Prometheus\n", len(availableMetrics))

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

	// Step 4: Build per-query breakdown
	for i, query := range queries {
		metrics, ok := queryMetrics[i]
		if !ok {
			// Query wasn't parsed successfully, skip
			continue
		}

		queryResult := validator.QueryResult{
			PanelTitle:   query.PanelTitle,
			PanelID:      query.PanelID,
			QueryRefID:   query.RefID,
			TotalMetrics: len(metrics),
		}

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
	} else {
		result.CompatibilityScore = 1.0 // No metrics = perfect compatibility
	}

	fmt.Printf("[DEBUG PROM] Validation complete! Score: %.2f, Found: %d/%d metrics\n",
		result.CompatibilityScore, result.FoundMetrics, result.TotalMetrics)

	return result, nil
}
