package migrator

import (
	"regexp"
)

// RemoveQuotesAroundVariableShared removes one set of quotes around template variable references.
// Handles both $var and ${var} formats.
// Only removes one layer of quotes (either single or double).
// This is the shared implementation used by both dashboard and resource migrations.
func RemoveQuotesAroundVariableShared(sql, variableName string) string {
	// Skip if the SQL uses any format option like ${var:csv}
	formattedVarPattern := regexp.MustCompile(`\$\{` + regexp.QuoteMeta(variableName) + `:[^}]*\}`)
	if formattedVarPattern.MatchString(sql) {
		return sql
	}

	result := sql

	// Pattern for single quotes around $var or ${var}
	singleQuotePattern := regexp.MustCompile(`'(\$\{?` + regexp.QuoteMeta(variableName) + `\}?)'`)
	result = singleQuotePattern.ReplaceAllString(result, "$1")

	// Pattern for double quotes around $var or ${var}
	doubleQuotePattern := regexp.MustCompile(`"(\$\{?` + regexp.QuoteMeta(variableName) + `\}?)"`)
	result = doubleQuotePattern.ReplaceAllString(result, "$1")

	return result
}

// ProcessPanelMapShared processes a single panel map and modifies its targets if conditions are met.
// Returns true if any modifications were made.
func ProcessPanelMapShared(panelMap map[string]any, templatingList []map[string]any) bool {
	modified := false

	// Check if panel has datasource
	datasourceInterface, ok := panelMap["datasource"]
	if !ok {
		return modified
	}

	datasourceMap, ok := datasourceInterface.(map[string]any)
	if !ok {
		return modified
	}

	// Check if datasource type is PostgreSQL
	dsType, ok := datasourceMap["type"].(string)
	if !ok || dsType != "grafana-postgresql-datasource" {
		return modified
	}

	// Check if panel has repeat
	repeatVar, ok := panelMap["repeat"].(string)
	if !ok || repeatVar == "" {
		return modified
	}

	// Find the template variable in templating list
	var templateVar map[string]any
	for _, tv := range templatingList {
		if name, ok := tv["name"].(string); ok && name == repeatVar {
			templateVar = tv
			break
		}
	}

	if templateVar == nil {
		return modified
	}

	// Check if variable has includeAll or multi
	includeAll, _ := templateVar["includeAll"].(bool)
	multi, _ := templateVar["multi"].(bool)
	if !includeAll && !multi {
		return modified
	}

	// Process all targets
	targetsInterface, ok := panelMap["targets"]
	if !ok {
		return modified
	}

	targetsList, ok := targetsInterface.([]any)
	if !ok {
		return modified
	}

	for _, targetInterface := range targetsList {
		targetMap, ok := targetInterface.(map[string]any)
		if !ok {
			continue
		}

		rawSql, ok := targetMap["rawSql"].(string)
		if !ok || rawSql == "" {
			continue
		}

		originalSql := rawSql
		newSql := RemoveQuotesAroundVariableShared(originalSql, repeatVar)

		if newSql != originalSql {
			targetMap["rawSql"] = newSql
			modified = true
		}
	}

	return modified
}

// ProcessPanelMapsShared recursively processes all panels including nested ones.
// Returns true if any modifications were made.
func ProcessPanelMapsShared(panelsList []any, templatingList []map[string]any) bool {
	modified := false

	for _, panelInterface := range panelsList {
		panelMap, ok := panelInterface.(map[string]any)
		if !ok {
			continue
		}

		// Process the panel itself
		if ProcessPanelMapShared(panelMap, templatingList) {
			modified = true
		}

		// Process nested panels (for row panels)
		if nestedPanelsInterface, ok := panelMap["panels"]; ok {
			if nestedPanelsList, ok := nestedPanelsInterface.([]any); ok && len(nestedPanelsList) > 0 {
				if ProcessPanelMapsShared(nestedPanelsList, templatingList) {
					modified = true
				}
			}
		}
	}

	return modified
}

// ExtractTemplatingListShared extracts the templating list from a dashboard or resource spec map.
func ExtractTemplatingListShared(data map[string]any) []map[string]any {
	templatingInterface, ok := data["templating"]
	if !ok {
		return nil
	}

	templatingMap, ok := templatingInterface.(map[string]any)
	if !ok {
		return nil
	}

	listInterface, ok := templatingMap["list"]
	if !ok {
		return nil
	}

	listArray, ok := listInterface.([]any)
	if !ok {
		return nil
	}

	result := make([]map[string]any, 0, len(listArray))
	for _, item := range listArray {
		if itemMap, ok := item.(map[string]any); ok {
			result = append(result, itemMap)
		}
	}

	return result
}

// ProcessDashboardOrResourceSpecShared processes a dashboard or resource spec map.
// Returns true if any modifications were made.
func ProcessDashboardOrResourceSpecShared(data map[string]any) bool {
	// Extract templating list
	templatingList := ExtractTemplatingListShared(data)

	// Get panels
	panelsInterface, ok := data["panels"]
	if !ok {
		return false
	}

	panelsList, ok := panelsInterface.([]any)
	if !ok || len(panelsList) == 0 {
		return false
	}

	// Process panels
	return ProcessPanelMapsShared(panelsList, templatingList)
}
