package schemaversion

import (
	"context"
	"fmt"
)

// V34 migrates CloudWatch queries that use multiple statistics into separate queries.
func V34(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(34)

	if panelsValue, exists := dashboard["panels"]; exists && IsArray(panelsValue) {
		panels := panelsValue.([]interface{})
		for _, panel := range panels {
			p, ok := panel.(map[string]interface{})
			if !ok {
				continue
			}

			migrateCloudWatchQueriesInPanel(p)

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

		if _, hasMetricQueryType := t["metricQueryType"]; !hasMetricQueryType {
			t["metricQueryType"] = 0
		}

		if _, hasMetricEditorMode := t["metricEditorMode"]; !hasMetricEditorMode {
			metricQueryType := GetIntValue(t, "metricQueryType", 0)
			if metricQueryType == 1 {
				t["metricEditorMode"] = 1
			} else {
				expression := GetStringValue(t, "expression")
				if expression != "" {
					t["metricEditorMode"] = 1
				} else {
					t["metricEditorMode"] = 0
				}
			}
		}

		validStats, isEmpty := getValidStatistics(t["statistics"])

		if isEmpty {
			delete(t, "statistics")
			newTargets = append(newTargets, t)
			continue
		}

		delete(t, "statistics")

		switch len(validStats) {
		case 0:
			newTargets = append(newTargets, t)
		case 1:
			if validStats[0] != nil {
				t["statistic"] = validStats[0]
			}
			newTargets = append(newTargets, t)
		default:
			for i, stat := range validStats {
				newQuery := copyMap(t)
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

		originalName := GetStringValue(a, "name")
		validStats, isEmpty := getValidStatistics(a["statistics"])

		if isEmpty {
			delete(a, "statistics")
			annotationsList[i] = a
			continue
		}

		switch len(validStats) {
		case 0:
			delete(a, "statistics")
			annotationsList[i] = a
		case 1:
			delete(a, "statistics")
			if validStats[0] != nil {
				a["statistic"] = validStats[0]
			}
			annotationsList[i] = a
		default:
			delete(a, "statistics")
			for j, stat := range validStats {
				newAnnotation := copyMap(a)
				if stat != nil {
					newAnnotation["statistic"] = stat
				}

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

func getValidStatistics(statisticsField interface{}) ([]interface{}, bool) {
	statistics, ok := statisticsField.([]interface{})
	if !ok {
		return nil, false
	}

	if len(statistics) == 0 {
		return nil, true
	}

	return statistics, false
}

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
	switch v := stat.(type) {
	case map[string]interface{}:
		return "[object Object]"
	case []interface{}:
		return ""
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", stat)
	}
}

func copyMap(original map[string]interface{}) map[string]interface{} {
	copy := make(map[string]interface{})
	for k, v := range original {
		copy[k] = v
	}
	return copy
}

func isCloudWatchQuery(target map[string]interface{}) bool {
	_, hasDimensions := target["dimensions"]
	_, hasNamespace := target["namespace"]
	_, hasRegion := target["region"]
	_, hasMetricName := target["metricName"]

	return hasDimensions && hasNamespace && hasRegion && hasMetricName
}

func isLegacyCloudWatchAnnotationQuery(annotation map[string]interface{}) bool {
	_, hasDimensions := annotation["dimensions"]
	_, hasNamespace := annotation["namespace"]
	_, hasRegion := annotation["region"]
	_, hasPrefixMatching := annotation["prefixMatching"]
	_, hasStatistics := annotation["statistics"]

	return hasDimensions && hasNamespace && hasRegion && hasPrefixMatching && hasStatistics
}

func generateNextRefId(allTargets []interface{}, additionalIndex int) string {
	used := make(map[string]bool)
	for _, target := range allTargets {
		if t, ok := target.(map[string]interface{}); ok {
			if refId, ok := t["refId"].(string); ok && refId != "" {
				used[refId] = true
			}
		}
	}

	for c := 'A'; c <= 'Z'; c++ {
		candidate := string(c)
		if !used[candidate] {
			return candidate
		}
	}

	for c1 := 'A'; c1 <= 'Z'; c1++ {
		for c2 := 'A'; c2 <= 'Z'; c2++ {
			candidate := string(c1) + string(c2)
			if !used[candidate] {
				return candidate
			}
		}
	}

	return "X" + string(rune('0'+additionalIndex))
}
