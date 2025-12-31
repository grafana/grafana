package validator

import (
	"context"
	"fmt"
	"net/http"
)

// DashboardCompatibilityRequest contains the dashboard and datasource mappings to validate
type DashboardCompatibilityRequest struct {
	DashboardJSON      map[string]interface{} // Dashboard JSON structure
	DatasourceMappings []DatasourceMapping    // List of datasources to validate against
}

// DatasourceMapping maps a datasource UID to its type and optionally name/URL
type DatasourceMapping struct {
	UID        string       // Datasource UID
	Type       string       // Datasource type (prometheus, mysql, etc.)
	Name       string       // Optional: Datasource name
	URL        string       // Datasource URL
	HTTPClient *http.Client // Authenticated HTTP client
}

// DashboardCompatibilityResult contains the validation results for a dashboard
type DashboardCompatibilityResult struct {
	CompatibilityScore float64                      // Overall compatibility (0.0 - 1.0)
	DatasourceResults  []DatasourceValidationResult // Per-datasource results
}

// DatasourceValidationResult contains validation results for one datasource
type DatasourceValidationResult struct {
	UID                string
	Type               string
	Name               string
	TotalQueries       int
	CheckedQueries     int
	TotalMetrics       int
	FoundMetrics       int
	MissingMetrics     []string
	QueryBreakdown     []QueryResult
	CompatibilityScore float64
}

// ValidateDashboardCompatibility is the main entry point for validating dashboard compatibility
// It extracts queries from the dashboard, validates them against each datasource, and returns aggregated results
func ValidateDashboardCompatibility(ctx context.Context, req DashboardCompatibilityRequest) (*DashboardCompatibilityResult, error) {
	result := &DashboardCompatibilityResult{
		DatasourceResults: make([]DatasourceValidationResult, 0, len(req.DatasourceMappings)),
	}

	// Step 1: Extract queries from dashboard JSON
	queries, err := extractQueriesFromDashboard(req.DashboardJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to extract queries from dashboard: %w", err)
	}

	fmt.Printf("[DEBUG] Extracted %d queries from dashboard\n", len(queries))
	for i, q := range queries {
		fmt.Printf("[DEBUG] Query %d: DS=%s, RefID=%s, Query=%s\n", i, q.DatasourceUID, q.RefID, q.QueryText)
	}

	// Step 2: Group queries by datasource UID
	queriesByDatasource := groupQueriesByDatasource(queries)

	fmt.Printf("[DEBUG] Grouped queries by %d datasources\n", len(queriesByDatasource))
	for dsUID, dsQueries := range queriesByDatasource {
		fmt.Printf("[DEBUG] Datasource %s has %d queries\n", dsUID, len(dsQueries))
	}

	// Step 3: Validate each datasource
	var totalCompatibility float64
	validatedCount := 0

	for _, dsMapping := range req.DatasourceMappings {
		fmt.Printf("[DEBUG] Processing datasource mapping: UID=%s, Type=%s, URL=%s\n", dsMapping.UID, dsMapping.Type, dsMapping.URL)

		// Get queries for this datasource
		dsQueries, ok := queriesByDatasource[dsMapping.UID]
		if !ok || len(dsQueries) == 0 {
			// No queries for this datasource, skip
			fmt.Printf("[DEBUG] No queries found for datasource %s, skipping\n", dsMapping.UID)
			continue
		}

		fmt.Printf("[DEBUG] Found %d queries for datasource %s\n", len(dsQueries), dsMapping.UID)

		// Get validator for this datasource type
		v, err := GetValidator(dsMapping.Type)
		if err != nil {
			// Unsupported datasource type, skip but log
			fmt.Printf("[DEBUG] Failed to get validator for type %s: %v\n", dsMapping.Type, err)
			continue
		}

		fmt.Printf("[DEBUG] Got validator for type %s, starting validation\n", dsMapping.Type)

		// Build Datasource struct
		ds := Datasource{
			UID:        dsMapping.UID,
			Type:       dsMapping.Type,
			Name:       dsMapping.Name,
			URL:        dsMapping.URL,
			HTTPClient: dsMapping.HTTPClient,
		}

		// Validate queries
		validationResult, err := v.ValidateQueries(ctx, dsQueries, ds)
		if err != nil {
			// Validation failed for this datasource, skip but could log
			continue
		}

		// Convert to DatasourceValidationResult
		dsResult := DatasourceValidationResult{
			UID:                dsMapping.UID,
			Type:               dsMapping.Type,
			Name:               dsMapping.Name,
			TotalQueries:       validationResult.TotalQueries,
			CheckedQueries:     validationResult.CheckedQueries,
			TotalMetrics:       validationResult.TotalMetrics,
			FoundMetrics:       validationResult.FoundMetrics,
			MissingMetrics:     validationResult.MissingMetrics,
			QueryBreakdown:     validationResult.QueryBreakdown,
			CompatibilityScore: validationResult.CompatibilityScore,
		}

		result.DatasourceResults = append(result.DatasourceResults, dsResult)
		totalCompatibility += validationResult.CompatibilityScore
		validatedCount++
	}

	// Step 4: Calculate overall compatibility score
	if validatedCount > 0 {
		result.CompatibilityScore = totalCompatibility / float64(validatedCount)
	} else {
		result.CompatibilityScore = 1.0 // No datasources = perfect compatibility
	}

	return result, nil
}

// extractQueriesFromDashboard parses the dashboard JSON and extracts all queries
// Supports both v1 (legacy) and v2 (new) dashboard formats
func extractQueriesFromDashboard(dashboardJSON map[string]interface{}) ([]DashboardQuery, error) {
	var queries []DashboardQuery

	// Debug: Print what keys we have
	fmt.Printf("[DEBUG] Dashboard JSON keys: ")
	for key := range dashboardJSON {
		fmt.Printf("%s, ", key)
	}
	fmt.Printf("\n")

	// Detect dashboard version (v1 uses "panels", v2 uses different structure)
	// For MVP, we only support v1 (legacy format with panels array)
	if !isV1Dashboard(dashboardJSON) {
		fmt.Printf("[DEBUG] isV1Dashboard returned false, 'panels' key exists: %v\n", dashboardJSON["panels"] != nil)
		return nil, fmt.Errorf("unsupported dashboard format: only v1 dashboards are supported in MVP")
	}

	// Extract panels array
	panels, ok := dashboardJSON["panels"].([]interface{})
	if !ok {
		// No panels in dashboard, return empty array
		return queries, nil
	}

	// Iterate through all panels
	for _, panelInterface := range panels {
		panel, ok := panelInterface.(map[string]interface{})
		if !ok {
			continue
		}

		// Extract queries from this panel
		panelQueries := extractQueriesFromPanel(panel)
		queries = append(queries, panelQueries...)

		// Handle nested panels in collapsed rows
		nestedPanels, hasNested := panel["panels"].([]interface{})
		if hasNested {
			for _, nestedPanelInterface := range nestedPanels {
				nestedPanel, ok := nestedPanelInterface.(map[string]interface{})
				if !ok {
					continue
				}
				nestedQueries := extractQueriesFromPanel(nestedPanel)
				queries = append(queries, nestedQueries...)
			}
		}
	}

	return queries, nil
}

// isV1Dashboard checks if a dashboard is in v1 (legacy) format
// v1 dashboards have a "panels" array at the top level
func isV1Dashboard(dashboard map[string]interface{}) bool {
	_, hasPanels := dashboard["panels"]
	return hasPanels
}

// extractQueriesFromPanel extracts all queries/targets from a single panel
func extractQueriesFromPanel(panel map[string]interface{}) []DashboardQuery {
	var queries []DashboardQuery

	// Get panel info for context
	panelTitle := getStringValue(panel, "title", "Untitled Panel")
	panelID := getIntValue(panel, "id", 0)

	// Extract targets array (queries)
	targets, hasTargets := panel["targets"].([]interface{})
	if !hasTargets {
		return queries
	}

	// Iterate through each target/query
	for _, targetInterface := range targets {
		target, ok := targetInterface.(map[string]interface{})
		if !ok {
			continue
		}

		// Extract datasource UID
		datasourceUID := extractDatasourceUID(target, panel)
		if datasourceUID == "" {
			// Skip queries without datasource
			continue
		}

		// Extract query text (different fields for different datasources)
		queryText := extractQueryText(target)
		if queryText == "" {
			// Skip empty queries
			continue
		}

		// Extract refId (A, B, C, etc.)
		refID := getStringValue(target, "refId", "")

		// Build DashboardQuery
		query := DashboardQuery{
			DatasourceUID: datasourceUID,
			RefID:         refID,
			QueryText:     queryText,
			PanelTitle:    panelTitle,
			PanelID:       panelID,
		}

		queries = append(queries, query)
	}

	return queries
}

// extractDatasourceUID gets the datasource UID from a target, falling back to panel datasource
func extractDatasourceUID(target map[string]interface{}, panel map[string]interface{}) string {
	// Try target-level datasource first
	if ds, ok := target["datasource"]; ok {
		if uid := getDatasourceUIDFromValue(ds); uid != "" {
			return uid
		}
	}

	// Fall back to panel-level datasource
	if ds, ok := panel["datasource"]; ok {
		if uid := getDatasourceUIDFromValue(ds); uid != "" {
			return uid
		}
	}

	return ""
}

// getDatasourceUIDFromValue extracts UID from datasource value (can be string or object)
func getDatasourceUIDFromValue(ds interface{}) string {
	switch v := ds.(type) {
	case string:
		// Direct UID string
		return v
	case map[string]interface{}:
		// Structured datasource reference { uid: "...", type: "..." }
		return getStringValue(v, "uid", "")
	default:
		return ""
	}
}

// extractQueryText extracts the query text from a target
// Different datasources use different field names (expr, query, rawSql, etc.)
func extractQueryText(target map[string]interface{}) string {
	// Try common query field names
	queryFields := []string{"expr", "query", "rawSql", "rawQuery", "target", "measurement"}

	for _, field := range queryFields {
		if queryText := getStringValue(target, field, ""); queryText != "" {
			return queryText
		}
	}

	return ""
}

// getStringValue safely extracts a string value from a map
func getStringValue(m map[string]interface{}, key string, defaultValue string) string {
	if value, ok := m[key]; ok {
		if s, ok := value.(string); ok {
			return s
		}
	}
	return defaultValue
}

// getIntValue safely extracts an int value from a map
func getIntValue(m map[string]interface{}, key string, defaultValue int) int {
	if value, ok := m[key]; ok {
		switch v := value.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case int64:
			return int(v)
		}
	}
	return defaultValue
}

// DashboardQuery represents a query extracted from a dashboard panel
type DashboardQuery struct {
	DatasourceUID string // Which datasource this query belongs to
	RefID         string // Query reference ID
	QueryText     string // The actual query
	PanelTitle    string // Panel title
	PanelID       int    // Panel ID
}

// groupQueriesByDatasource groups dashboard queries by their datasource UID
func groupQueriesByDatasource(queries []DashboardQuery) map[string][]Query {
	grouped := make(map[string][]Query)

	for _, dq := range queries {
		q := Query{
			RefID:      dq.RefID,
			QueryText:  dq.QueryText,
			PanelTitle: dq.PanelTitle,
			PanelID:    dq.PanelID,
		}

		grouped[dq.DatasourceUID] = append(grouped[dq.DatasourceUID], q)
	}

	return grouped
}
