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

		// Check if this query has multiple statistics
		statistics, hasStatistics := t["statistics"].([]interface{})
		if !hasStatistics || len(statistics) <= 1 {
			// Convert single statistic or no statistics to proper format
			if hasStatistics && len(statistics) == 1 {
				if stat, ok := statistics[0].(string); ok {
					t["statistic"] = stat
				}
			}
			delete(t, "statistics")
			newTargets = append(newTargets, t)
			continue
		}

		// Split query with multiple statistics into separate queries
		// First, collect all valid statistics
		var validStatistics []string
		for _, stat := range statistics {
			statString, ok := stat.(string)
			if !ok {
				continue
			}
			validStatistics = append(validStatistics, statString)
		}

		// If no valid statistics found, remove statistics field and keep original query
		if len(validStatistics) == 0 {
			delete(t, "statistics")
			newTargets = append(newTargets, t)
			continue
		}

		// Create separate queries for each valid statistic
		for i, statString := range validStatistics {
			// Create a copy of the original query
			newQuery := make(map[string]interface{})
			for k, v := range t {
				if k != "statistics" {
					newQuery[k] = v
				}
			}

			// Set the single statistic
			newQuery["statistic"] = statString

			if i == 0 {
				// First query replaces the original
				newTargets = append(newTargets, newQuery)
			} else {
				// Additional queries get new refIds and are added at the end
				newQuery["refId"] = generateNextRefId(append(targets, additionalTargets...), len(additionalTargets))
				additionalTargets = append(additionalTargets, newQuery)
			}
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

	for i, annotation := range annotationsList {
		a, ok := annotation.(map[string]interface{})
		if !ok {
			continue
		}

		if !isLegacyCloudWatchAnnotationQuery(a) {
			continue
		}

		// Check if this annotation has multiple statistics
		statistics, hasStatistics := a["statistics"].([]interface{})
		if !hasStatistics || len(statistics) <= 1 {
			// Convert single statistic to proper format
			if hasStatistics && len(statistics) == 1 {
				if stat, ok := statistics[0].(string); ok {
					// Create new annotation with single statistic
					newAnnotation := make(map[string]interface{})
					for k, v := range a {
						if k != "statistics" {
							newAnnotation[k] = v
						}
					}
					newAnnotation["statistic"] = stat
					annotationsList[i] = newAnnotation
				}
			} else {
				// Always remove statistics field, even if empty or no statistics
				newAnnotation := make(map[string]interface{})
				for k, v := range a {
					if k != "statistics" {
						newAnnotation[k] = v
					}
				}
				annotationsList[i] = newAnnotation
			}
			continue
		}

		// Split annotation with multiple statistics into separate annotations
		// First, collect all valid statistics
		var validStatistics []string
		for _, stat := range statistics {
			statString, ok := stat.(string)
			if !ok {
				continue
			}
			validStatistics = append(validStatistics, statString)
		}

		// If no valid statistics found, remove statistics field and keep original annotation
		if len(validStatistics) == 0 {
			// Create new annotation without statistics field
			newAnnotation := make(map[string]interface{})
			for k, v := range a {
				if k != "statistics" {
					newAnnotation[k] = v
				}
			}
			annotationsList[i] = newAnnotation
			continue
		}

		// Create new annotations for each valid statistic, replace original with first one
		originalName, hasName := a["name"].(string)

		for j, statString := range validStatistics {
			// Create new annotation for this statistic
			newAnnotation := make(map[string]interface{})
			for k, v := range a {
				if k != "statistics" {
					newAnnotation[k] = v
				}
			}

			// Set the single statistic
			newAnnotation["statistic"] = statString

			// Set the name with statistic suffix if multiple valid statistics
			if len(validStatistics) > 1 && hasName {
				newAnnotation["name"] = originalName + " - " + statString
			}

			if j == 0 {
				// Replace the original annotation with the first new one
				annotationsList[i] = newAnnotation
			} else {
				// Add additional annotations to be appended later
				additionalAnnotations = append(additionalAnnotations, newAnnotation)
			}
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
