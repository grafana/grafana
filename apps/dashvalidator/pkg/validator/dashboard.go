package validator

import (
	"context"
	"fmt"
	"strings"
)

// DashboardCompatibilityRequest contains the dashboard and datasources to validate
type DashboardCompatibilityRequest struct {
	DashboardJSON map[string]interface{} // Dashboard JSON structure
	Datasources   []Datasource           // List of datasources to validate against
}

// DashboardCompatibilityResult contains the validation results for a dashboard
type DashboardCompatibilityResult struct {
	CompatibilityScore float64                      // Overall compatibility (0.0 - 1.0)
	DatasourceResults  []DatasourceValidationResult // Per-datasource results
}

// DatasourceValidationResult contains validation results for one datasource.
// It embeds ValidationResult and adds datasource identification fields.
type DatasourceValidationResult struct {
	ValidationResult        // Embedded: contains all validation metrics
	UID              string `json:"uid"`  // Datasource UID
	Type             string `json:"type"` // Datasource type (prometheus, mysql, etc.)
	Name             string `json:"name"` // Datasource name for display
}

// ValidateDashboardCompatibility is the main entry point for validating dashboard compatibility
// It extracts queries from the dashboard, validates them against each datasource, and returns aggregated results
// validators is a map of datasource type -> validator (e.g., "prometheus" -> PrometheusValidator)
func ValidateDashboardCompatibility(ctx context.Context, req DashboardCompatibilityRequest, validators map[string]DatasourceValidator) (*DashboardCompatibilityResult, error) {
	// MVP: Only support single datasource validation
	if len(req.Datasources) != 1 {
		return nil, fmt.Errorf("MVP only supports single datasource validation, got %d datasources", len(req.Datasources))
	}

	singleDatasource := req.Datasources[0]

	result := &DashboardCompatibilityResult{
		DatasourceResults: make([]DatasourceValidationResult, 0, len(req.Datasources)),
	}

	// Step 1: Extract queries from dashboard JSON
	queries, err := extractQueriesFromDashboard(req.DashboardJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to extract queries from dashboard: %w", err)
	}

	// Step 2: Group queries by datasource UID (with variable resolution for MVP)
	queriesByDatasource := groupQueriesByDatasource(queries, singleDatasource.UID, req.DashboardJSON)

	// Step 3: Validate each datasource
	var totalCompatibility float64
	validatedCount := 0

	for _, ds := range req.Datasources {
		// Get queries for this datasource
		dsQueries, ok := queriesByDatasource[ds.UID]
		if !ok || len(dsQueries) == 0 {
			// No queries for this datasource, skip
			continue
		}

		// Get validator for this datasource type
		v, ok := validators[ds.Type]
		if !ok {
			// Unsupported datasource type, skip
			continue
		}

		// Validate queries
		validationResult, err := v.ValidateQueries(ctx, dsQueries, ds)
		if err != nil {
			// Validation failed for this datasource - return error to caller
			// This could be a connection error, auth error, or other critical failure
			return nil, fmt.Errorf("validation failed for datasource %s: %w", ds.UID, err)
		}

		// Build result using embedded ValidationResult
		dsResult := DatasourceValidationResult{
			ValidationResult: *validationResult,
			UID:              ds.UID,
			Type:             ds.Type,
			Name:             ds.Name,
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
// Both formats v1 (legacy) and v2 (new) can be passed, but we only support v1 in MVP
func extractQueriesFromDashboard(dashboardJSON map[string]interface{}) ([]DashboardQuery, error) {
	var queries []DashboardQuery

	// Detect dashboard version (v1 uses "panels", v2 uses different structure)
	// For MVP, we only support v1 (legacy format with panels array)
	if !isV1Dashboard(dashboardJSON) {
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
// v2 dashboards have "elements" map and "layout" structure
//
// This follows Grafana's official dashboard conversion logic which uses
// type-safe assertions to distinguish between formats.
// Reference: apps/dashboard/pkg/migration/conversion/v1beta1_to_v2alpha1.go:450
func isV1Dashboard(dashboard map[string]interface{}) bool {
	// Check for v2 indicators first (positive identification)
	// v2 dashboards use a map of elements, not an array
	if _, hasElements := dashboard["elements"].(map[string]interface{}); hasElements {
		return false // Definitely v2
	}

	// v2 dashboards also have a layout structure
	if _, hasLayout := dashboard["layout"]; hasLayout {
		return false // v2 has layout field
	}

	// Check for v1 panels with type assertion (must be an array)
	// This is type-safe: `{"panels": "string"}` would fail this check and return false
	_, hasPanels := dashboard["panels"].([]interface{})
	return hasPanels
}

// extractQueriesFromPanel extracts all queries/targets from a single panel
func extractQueriesFromPanel(panel map[string]interface{}) []DashboardQuery {
	// Extract targets array (queries) first to know capacity
	targets, hasTargets := panel["targets"].([]interface{})
	if !hasTargets {
		return nil
	}

	// Pre-allocate with capacity since we know max size
	queries := make([]DashboardQuery, 0, len(targets))

	// Get panel info for context
	panelTitle := getStringValue(panel, "title", "Untitled Panel")
	panelID := getIntValue(panel, "id", 0)

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

// isWordChar checks if a character is a valid variable name character.
// Matches \w in regex: [A-Za-z0-9_] (alphanumeric + underscore, NO dashes)
func isWordChar(ch rune) bool {
	return (ch >= 'a' && ch <= 'z') ||
		(ch >= 'A' && ch <= 'Z') ||
		(ch >= '0' && ch <= '9') ||
		ch == '_'
}

// isDollarBraceVar checks if string matches ${varname} pattern.
// Supports ${var}, ${var.field}, and ${var:format} syntax.
func isDollarBraceVar(s string) bool {
	if len(s) <= 3 || s[0] != '$' || s[1] != '{' || s[len(s)-1] != '}' {
		return false
	}
	content := s[2 : len(s)-1]
	if len(content) == 0 {
		return false
	}
	for i, ch := range content {
		if ch == '.' || ch == ':' {
			return i > 0
		}
		if !isWordChar(ch) {
			return false
		}
	}
	return true
}

// isDollarVar checks if string matches $varname pattern.
func isDollarVar(s string) bool {
	if len(s) <= 1 || s[0] != '$' {
		return false
	}
	// Avoid matching ${...} pattern
	if s[1] == '{' {
		return false
	}
	for i := 1; i < len(s); i++ {
		if !isWordChar(rune(s[i])) {
			return false
		}
	}
	return true
}

// isDoubleBracketVar checks if string matches [[varname]] pattern.
// Supports [[var]] and [[var:format]] syntax.
func isDoubleBracketVar(s string) bool {
	if len(s) <= 4 || s[0] != '[' || s[1] != '[' || s[len(s)-2] != ']' || s[len(s)-1] != ']' {
		return false
	}
	content := s[2 : len(s)-2]
	if len(content) == 0 {
		return false
	}
	for i, ch := range content {
		if ch == ':' {
			return i > 0
		}
		if !isWordChar(ch) {
			return false
		}
	}
	return true
}

// isVariableReference checks if a string is a template variable reference.
// Matches patterns: ${varname}, $varname, [[varname]]
// Follows Grafana's frontend regex: /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g
// where \w = [A-Za-z0-9_] (alphanumeric + underscore, NO dashes)
func isVariableReference(uid string) bool {
	if uid == "" {
		return false
	}
	return isDollarBraceVar(uid) || isDollarVar(uid) || isDoubleBracketVar(uid)
}

// extractVariableName extracts the variable name from a variable reference
// Returns only the name part, excluding fieldPath (after .) and format (after :)
// Examples: ${var.field} -> "var", [[var:text]] -> "var", $datasource -> "datasource"
func extractVariableName(varRef string) string {
	if !isVariableReference(varRef) {
		return ""
	}

	// Handle ${varname} pattern - may include .fieldPath or :format
	if len(varRef) > 3 && varRef[0] == '$' && varRef[1] == '{' && varRef[len(varRef)-1] == '}' {
		content := varRef[2 : len(varRef)-1]
		// Extract only up to . or :
		for i, ch := range content {
			if ch == '.' || ch == ':' {
				return content[:i]
			}
		}
		return content
	}

	// Handle $varname pattern - no modifiers possible
	if varRef[0] == '$' && len(varRef) > 1 {
		return varRef[1:]
	}

	// Handle [[varname]] pattern - may include :format
	if len(varRef) > 4 && varRef[0] == '[' && varRef[1] == '[' {
		content := varRef[2 : len(varRef)-2]
		// Extract only up to :
		for i, ch := range content {
			if ch == ':' {
				return content[:i]
			}
		}
		return content
	}

	return ""
}

// isPrometheusVariable checks if a variable reference points to a Prometheus datasource
// Looks in dashboard.__inputs for the datasource type
func isPrometheusVariable(varRef string, dashboardJSON map[string]interface{}) bool {
	if !isVariableReference(varRef) {
		return false
	}

	varName := extractVariableName(varRef)
	if varName == "" {
		return false
	}

	// Look for __inputs array in dashboard
	inputs, hasInputs := dashboardJSON["__inputs"].([]interface{})
	if !hasInputs {
		// No __inputs, assume it might be Prometheus (MVP: single datasource)
		// This is a fallback for dashboards without explicit __inputs
		return true
	}

	// Search for this variable in __inputs
	for _, inputInterface := range inputs {
		input, ok := inputInterface.(map[string]interface{})
		if !ok {
			continue
		}

		// Check if this input matches our variable name
		inputName := getStringValue(input, "name", "")
		inputType := getStringValue(input, "type", "")
		inputPluginID := getStringValue(input, "pluginId", "")

		// Match by name (case-insensitive for flexibility)
		if inputName != "" && varName != "" {
			if inputName == varName ||
				strings.EqualFold(inputName, varName) ||
				strings.Contains(strings.ToLower(varName), strings.ToLower(inputName)) {
				// Check if it's a datasource input with prometheus plugin
				if inputType == "datasource" && inputPluginID == "prometheus" {
					return true
				}
			}
		}
	}

	// Not found or not Prometheus
	return false
}

// resolveDatasourceUID resolves a datasource UID, handling variable references (MVP: single datasource)
// For MVP, all Prometheus variables resolve to the single datasource UID
func resolveDatasourceUID(uid string, singleDatasourceUID string, dashboardJSON map[string]interface{}) string {
	// If not a variable, return as-is (concrete UID)
	if !isVariableReference(uid) {
		return uid
	}

	// Check if it's a Prometheus variable
	if isPrometheusVariable(uid, dashboardJSON) {
		return singleDatasourceUID
	}

	// Non-Prometheus variable, return as-is (will be ignored in grouping)
	return uid
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
// For MVP: resolves Prometheus template variables to the single datasource UID
func groupQueriesByDatasource(queries []DashboardQuery, singleDatasourceUID string, dashboardJSON map[string]interface{}) map[string][]Query {
	grouped := make(map[string][]Query)

	for _, dq := range queries {
		q := Query{
			RefID:      dq.RefID,
			QueryText:  dq.QueryText,
			PanelTitle: dq.PanelTitle,
			PanelID:    dq.PanelID,
		}

		// Resolve datasource UID (handles both concrete UIDs and variables)
		resolvedUID := resolveDatasourceUID(dq.DatasourceUID, singleDatasourceUID, dashboardJSON)

		// Only add to grouping if we got a valid resolved UID
		if resolvedUID != "" {
			grouped[resolvedUID] = append(grouped[resolvedUID], q)
		}
	}

	return grouped
}
