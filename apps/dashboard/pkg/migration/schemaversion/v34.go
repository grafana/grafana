package schemaversion

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
func V34(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(34)

	// Migrate panel queries if panels exist
	panels, _ := dashboard["panels"].([]interface{})
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		migrateCloudWatchQueriesInPanel(p)

		// Handle nested panels in collapsed rows
		nestedPanels, hasNested := p["panels"].([]interface{})
		if !hasNested {
			continue
		}
		for _, nestedPanel := range nestedPanels {
			np, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			migrateCloudWatchQueriesInPanel(np)
		}
	}

	// Always migrate annotation queries regardless of whether panels exist
	migrateCloudWatchAnnotationQueries(dashboard)

	return nil
}

// migrateCloudWatchQueriesInPanel migrates CloudWatch queries within a panel that use multiple statistics.
func migrateCloudWatchQueriesInPanel(panel map[string]interface{}) {
	targets, ok := panel["targets"].([]interface{})
	if !ok {
		return
	}

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

		// Add CloudWatch-specific fields to match frontend behavior
		// Add metricQueryType if not present (default to 0 = Search)
		if _, hasMetricQueryType := t["metricQueryType"]; !hasMetricQueryType {
			t["metricQueryType"] = 0
		}
		// Add metricEditorMode if not present
		if _, hasMetricEditorMode := t["metricEditorMode"]; !hasMetricEditorMode {
			if _, hasExpression := t["expression"]; hasExpression {
				t["metricEditorMode"] = 1 // Code mode
			} else {
				t["metricEditorMode"] = 0 // Builder mode
			}
		}

		// Check if this query has multiple statistics - match frontend behavior exactly
		statistics, hasStatistics := t["statistics"].([]interface{})
		if !hasStatistics || len(statistics) == 0 {
			// No statistics array or empty - just remove statistics field
			delete(t, "statistics")
			newTargets = append(newTargets, t)
			continue
		}

		if len(statistics) == 1 {
			// Single statistic - convert to statistic field
			t["statistic"] = statistics[0] // Don't validate - frontend doesn't validate
			delete(t, "statistics")
			newTargets = append(newTargets, t)
			continue
		}

		// Multiple statistics - split into separate queries
		// Frontend sets first statistic directly without validation
		t["statistic"] = statistics[0]
		delete(t, "statistics")
		newTargets = append(newTargets, t)

		// Create additional queries for remaining statistics (starting from index 1)
		for i := 1; i < len(statistics); i++ {
			// Create a copy of the original query
			newQuery := make(map[string]interface{})
			for k, v := range t {
				newQuery[k] = v
			}

			// Set the statistic (don't validate - frontend doesn't validate)
			newQuery["statistic"] = statistics[i]

			// Generate new refId
			newQuery["refId"] = generateNextRefId(append(targets, additionalTargets...), len(additionalTargets))
			additionalTargets = append(additionalTargets, newQuery)
		}
	}

	// Append additional queries at the end
	panel["targets"] = append(newTargets, additionalTargets...)
}

// migrateCloudWatchAnnotationQueries migrates CloudWatch annotation queries that use multiple statistics.
func migrateCloudWatchAnnotationQueries(dashboard map[string]interface{}) {
	annotations, ok := dashboard["annotations"].(map[string]interface{})
	if !ok {
		return
	}

	annotationsList, ok := annotations["list"].([]interface{})
	if !ok {
		return
	}

	var additionalAnnotations []interface{}

	for _, annotation := range annotationsList {
		a, ok := annotation.(map[string]interface{})
		if !ok {
			continue
		}

		if !isLegacyCloudWatchAnnotationQuery(a) {
			continue
		}

		// Check if this annotation has multiple statistics - match frontend behavior exactly
		statistics, hasStatistics := a["statistics"].([]interface{})
		if !hasStatistics || len(statistics) == 0 {
			// No statistics array or empty - just remove statistics field
			delete(a, "statistics")
			continue
		}

		if len(statistics) == 1 {
			// Single statistic - convert to statistic field (no validation like frontend)
			a["statistic"] = statistics[0]
			delete(a, "statistics")
			continue
		}

		// Multiple statistics - split like frontend does
		originalName, hasName := a["name"].(string)

		// Set first statistic on original annotation (no validation)
		a["statistic"] = statistics[0]
		delete(a, "statistics")

		// Only change the name if we're creating additional annotations
		if hasName {
			// Convert statistic to string for name suffix - handle null/non-string values like frontend
			statString := "null"
			if statValue, ok := a["statistic"].(string); ok {
				statString = statValue
			}
			a["name"] = originalName + " - " + statString
		}

		// Create additional annotations for remaining statistics (starting from index 1)
		for j := 1; j < len(statistics); j++ {
			// Create new annotation for this statistic
			newAnnotation := make(map[string]interface{})
			for k, v := range a {
				newAnnotation[k] = v
			}

			// Set the statistic (no validation like frontend)
			newAnnotation["statistic"] = statistics[j]

			// Set the name with statistic suffix
			if hasName {
				// Handle null/non-string values like frontend
				statString := "null"
				if statValue, ok := statistics[j].(string); ok {
					statString = statValue
				}
				newAnnotation["name"] = originalName + " - " + statString
			}

			additionalAnnotations = append(additionalAnnotations, newAnnotation)
		}
	}

	// Add additional annotations to the end of the list
	if len(additionalAnnotations) > 0 {
		annotations["list"] = append(annotationsList, additionalAnnotations...)
	}
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

// migrateCloudWatchQueryFields adds CloudWatch-specific fields to match frontend behavior
func migrateCloudWatchQueryFields(query map[string]interface{}) {
	// Add metricQueryType if not present (default to 0 = Search)
	if _, hasMetricQueryType := query["metricQueryType"]; !hasMetricQueryType {
		query["metricQueryType"] = 0 // MetricQueryType.Search
	}

	// Add metricEditorMode if not present
	if _, hasMetricEditorMode := query["metricEditorMode"]; !hasMetricEditorMode {
		metricQueryType, _ := query["metricQueryType"].(int)
		if metricQueryType == 1 { // MetricQueryType.Insights
			query["metricEditorMode"] = 1 // MetricEditorMode.Code
		} else {
			// Check if expression exists to determine editor mode
			if _, hasExpression := query["expression"]; hasExpression {
				query["metricEditorMode"] = 1 // MetricEditorMode.Code
			} else {
				query["metricEditorMode"] = 0 // MetricEditorMode.Builder
			}
		}
	}
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
