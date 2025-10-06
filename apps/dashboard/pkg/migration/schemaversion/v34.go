package schemaversion

import (
	"context"
	"fmt"
)

// V34 migrates CloudWatch queries that use multiple statistics into separate queries.
//
// This migration addresses CloudWatch queries where a single query uses multiple statistics
// (e.g., statistics: ['Max', 'Min']). The migration splits these into separate queries,
// each with a single statistic (e.g., one query with statistic: 'Max', another with statistic: 'Min').
//
// The migration works by:
// 1. Identifying CloudWatch queries in panel targets that have a 'statistics' array
// 2. Creating separate queries for each statistic in the array
// 3. Replacing the original 'statistics' array with a single 'statistic' field
// 4. Generating new refIds for additional queries (B, C, D, etc.)
// 5. Applying the same logic to CloudWatch annotation queries
// 6. Adding statistic suffixes to annotation names when multiple annotations are created
//
// Panel Query Example - Multiple Statistics:
//
// Before migration:
//
//	target: {
//	  refId: "A",
//	  dimensions: {"InstanceId": "i-123"},
//	  namespace: "AWS/EC2",
//	  region: "us-east-1",
//	  metricName: "CPUUtilization",
//	  statistics: ["Average", "Maximum", "Minimum"]
//	}
//
// After migration:
//
//	targets: [
//	  { refId: "A", dimensions: {"InstanceId": "i-123"}, namespace: "AWS/EC2", region: "us-east-1", metricName: "CPUUtilization", statistic: "Average" },
//	  { refId: "B", dimensions: {"InstanceId": "i-123"}, namespace: "AWS/EC2", region: "us-east-1", metricName: "CPUUtilization", statistic: "Maximum" },
//	  { refId: "C", dimensions: {"InstanceId": "i-123"}, namespace: "AWS/EC2", region: "us-east-1", metricName: "CPUUtilization", statistic: "Minimum" }
//	]
//
// Annotation Query Example - Multiple Statistics:
// Before migration:
//
//	annotation: {
//	  name: "CloudWatch Alerts",
//	  dimensions: {"InstanceId": "i-123"},
//	  namespace: "AWS/EC2",
//	  region: "us-east-1",
//	  prefixMatching: false,
//	  statistics: ["Maximum", "Minimum"]
//	}
//
// After migration:
//
//	annotations: [
//	  { name: "CloudWatch Alerts - Maximum", dimensions: {"InstanceId": "i-123"}, namespace: "AWS/EC2", region: "us-east-1", prefixMatching: false, statistic: "Maximum" },
//	  { name: "CloudWatch Alerts - Minimum", dimensions: {"InstanceId": "i-123"}, namespace: "AWS/EC2", region: "us-east-1", prefixMatching: false, statistic: "Minimum" }
//	]
func V34(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(34)

	// Migrate panel queries if panels exist and are an array
	if panelsValue, exists := dashboard["panels"]; exists && IsArray(panelsValue) {
		panels := panelsValue.([]interface{})
		for _, panel := range panels {
			p, ok := panel.(map[string]interface{})
			if !ok {
				continue
			}

			migrateCloudWatchQueriesInPanel(p)

			// Handle nested panels in collapsed rows
			if !IsArray(p["panels"]) {
				continue
			}
			nestedPanels := p["panels"].([]interface{})

			for _, nestedPanel := range nestedPanels {
				np, ok := nestedPanel.(map[string]interface{})
				if !ok {
					continue
				}
				migrateCloudWatchQueriesInPanel(np)
			}
		}
	}

	// Always migrate annotation queries regardless of whether panels exist
	migrateCloudWatchAnnotationQueries(dashboard)

	return nil
}

// migrateCloudWatchQueriesInPanel migrates CloudWatch queries within a panel that use multiple statistics.
func migrateCloudWatchQueriesInPanel(panel map[string]interface{}) {
	if !IsArray(panel["targets"]) {
		return
	}
	targets := panel["targets"].([]interface{})

	var newTargets []interface{}
	var additionalTargets []interface{}

	for _, target := range targets {
		t, ok := target.(map[string]interface{})
		if !ok {
			newTargets = append(newTargets, target)
			continue
		}

		if !isCloudWatchQuery(t) {
			newTargets = append(newTargets, target)
			continue
		}

		// Add CloudWatch fields if missing (matches frontend migrateCloudWatchQuery logic)
		if _, hasMetricQueryType := t["metricQueryType"]; !hasMetricQueryType {
			t["metricQueryType"] = 0 // MetricQueryType.Search
		}

		if _, hasMetricEditorMode := t["metricEditorMode"]; !hasMetricEditorMode {
			metricQueryType := GetIntValue(t, "metricQueryType", 0)
			if metricQueryType == 1 { // MetricQueryType.Insights
				t["metricEditorMode"] = 1 // MetricEditorMode.Code
			} else {
				expression := GetStringValue(t, "expression")
				if expression != "" {
					t["metricEditorMode"] = 1 // MetricEditorMode.Code
				} else {
					t["metricEditorMode"] = 0 // MetricEditorMode.Builder
				}
			}
		}

		// Get valid statistics (including null and empty strings)
		validStats, isEmpty := getValidStatistics(t["statistics"])

		// Handle empty array case (delete statistics field like frontend)
		if isEmpty {
			// Delete statistics field to match frontend behavior
			delete(t, "statistics")
			newTargets = append(newTargets, t)
			continue
		}

		// Remove statistics field for processing
		delete(t, "statistics")

		// Handle based on number of valid statistics
		switch len(validStats) {
		case 0:
			// No valid statistics - keep query as-is
			newTargets = append(newTargets, t)
		case 1:
			// Single statistic - set statistic field
			// Frontend doesn't set statistic property for null values
			if validStats[0] != nil {
				t["statistic"] = validStats[0]
			}
			newTargets = append(newTargets, t)
		default:
			// Multiple statistics - create separate queries
			for i, stat := range validStats {
				newQuery := copyMap(t)
				// Set statistic field
				// Frontend doesn't set statistic property for null values
				if stat != nil {
					newQuery["statistic"] = stat
				}

				if i == 0 {
					newTargets = append(newTargets, newQuery)
				} else {
					newQuery["refId"] = generateNextRefId(append(targets, additionalTargets...), len(additionalTargets))
					additionalTargets = append(additionalTargets, newQuery)
				}
			}
		}
	}

	panel["targets"] = append(newTargets, additionalTargets...)
}

// migrateCloudWatchAnnotationQueries migrates CloudWatch annotation queries that use multiple statistics.
func migrateCloudWatchAnnotationQueries(dashboard map[string]interface{}) {
	annotations, ok := dashboard["annotations"].(map[string]interface{})
	if !ok {
		return
	}

	if !IsArray(annotations["list"]) {
		return
	}
	annotationsList := annotations["list"].([]interface{})

	var additionalAnnotations []interface{}

	for i, annotation := range annotationsList {
		a, ok := annotation.(map[string]interface{})
		if !ok {
			continue
		}

		if !isLegacyCloudWatchAnnotationQuery(a) {
			continue
		}

		// Get original name for suffix generation
		originalName := GetStringValue(a, "name")

		// Get valid statistics (including null and empty strings)
		validStats, isEmpty := getValidStatistics(a["statistics"])

		// Handle empty array case (delete statistics field like frontend)
		if isEmpty {
			// Delete statistics field to match frontend behavior
			delete(a, "statistics")
			annotationsList[i] = a
			continue
		}

		// Handle based on number of valid statistics
		switch len(validStats) {
		case 0:
			// No valid statistics - remove statistics field
			delete(a, "statistics")
			annotationsList[i] = a
		case 1:
			// Single statistic - set statistic field (matches frontend behavior)
			delete(a, "statistics")
			// Frontend doesn't set statistic property for null values
			if validStats[0] != nil {
				a["statistic"] = validStats[0]
			}
			annotationsList[i] = a
		default:
			// Multiple statistics - create separate annotations
			delete(a, "statistics")
			for j, stat := range validStats {
				newAnnotation := copyMap(a)
				// Set statistic field (matches frontend behavior)
				// Frontend doesn't set statistic property for null values
				if stat != nil {
					newAnnotation["statistic"] = stat
				}

				// Add suffix to name
				if originalName != "" {
					suffix := getSuffixForStat(stat)
					newAnnotation["name"] = originalName + " - " + suffix
				}

				if j == 0 {
					annotationsList[i] = newAnnotation
				} else {
					additionalAnnotations = append(additionalAnnotations, newAnnotation)
				}
			}
		}
	}

	if len(additionalAnnotations) > 0 {
		annotations["list"] = append(annotationsList, additionalAnnotations...)
	}
}

// getValidStatistics extracts valid statistics from the statistics field
func getValidStatistics(statisticsField interface{}) ([]interface{}, bool) {
	statistics, ok := statisticsField.([]interface{})
	if !ok {
		return nil, false
	}

	// Special case: empty arrays should be preserved
	if len(statistics) == 0 {
		return nil, true // Return nil with true flag to indicate "empty array"
	}

	// Frontend processes ALL values in statistics array, regardless of type
	// It doesn't filter out invalid types - it processes them as-is
	return statistics, false
}

// getSuffixForStat returns the appropriate suffix for annotation names
func getSuffixForStat(stat interface{}) string {
	if stat == nil {
		return "null"
	}
	if statString, ok := stat.(string); ok {
		if statString == "" {
			return ""
		}
		return statString
	}
	// For non-string types, convert to string representation like JavaScript does
	switch v := stat.(type) {
	case map[string]interface{}:
		return "[object Object]" // JavaScript behavior for objects
	case []interface{}:
		return "" // JavaScript behavior for arrays (empty string)
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", stat) // Numbers and other types
	}
}

// copyMap creates a shallow copy of a map
func copyMap(original map[string]interface{}) map[string]interface{} {
	copy := make(map[string]interface{})
	for k, v := range original {
		copy[k] = v
	}
	return copy
}

// isCloudWatchQuery checks if a query target is a CloudWatch query.
func isCloudWatchQuery(target map[string]interface{}) bool {
	// Check for required CloudWatch query fields
	_, hasDimensions := target["dimensions"]
	_, hasNamespace := target["namespace"]
	_, hasRegion := target["region"]
	_, hasMetricName := target["metricName"]

	return hasDimensions && hasNamespace && hasRegion && hasMetricName
}

// isLegacyCloudWatchAnnotationQuery checks if an annotation is a legacy CloudWatch annotation query.
func isLegacyCloudWatchAnnotationQuery(annotation map[string]interface{}) bool {
	// Check for required CloudWatch annotation fields
	_, hasDimensions := annotation["dimensions"]
	_, hasNamespace := annotation["namespace"]
	_, hasRegion := annotation["region"]
	_, hasPrefixMatching := annotation["prefixMatching"]
	_, hasStatistics := annotation["statistics"]

	return hasDimensions && hasNamespace && hasRegion && hasPrefixMatching && hasStatistics
}

// generateNextRefId generates a new refId for additional queries created during migration.
func generateNextRefId(allTargets []interface{}, additionalIndex int) string {
	// Collect all existing refIds
	used := make(map[string]bool)
	for _, target := range allTargets {
		if t, ok := target.(map[string]interface{}); ok {
			if refId, ok := t["refId"].(string); ok && refId != "" {
				used[refId] = true
			}
		}
	}

	// Generate next available refId starting from A
	for c := 'A'; c <= 'Z'; c++ {
		candidate := string(c)
		if !used[candidate] {
			return candidate
		}
	}

	// If all single letters are taken, use double letters
	for c1 := 'A'; c1 <= 'Z'; c1++ {
		for c2 := 'A'; c2 <= 'Z'; c2++ {
			candidate := string(c1) + string(c2)
			if !used[candidate] {
				return candidate
			}
		}
	}

	// Fallback (should never happen in practice)
	return "X" + string(rune('0'+additionalIndex))
}
