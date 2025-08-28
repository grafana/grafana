package schemaversion

import (
	"strconv"
)

// V30 upgrades value mappings and migrates tooltip options for panels.
//
// This migration addresses two key improvements to panel configurations:
// 1. Value mappings upgrade: Converts legacy value mapping format to the new structured format
// 2. Tooltip options migration: Renames tooltipOptions to tooltip in specific panel types: timeseries, xychart, xychart2
//
// The migration works by:
// 1. Iterating through all panels in the dashboard, including nested panels in collapsed rows
// 2. For each panel, upgrading value mappings in fieldConfig.defaults and fieldConfig.overrides
// 3. Migrating tooltip options for timeseries, xychart, and xychart2 panels
// 4. Preserving all other panel configurations and options
//
// Value Mappings Migration:
// - Converts legacy mapping types (1 = ValueToText, 2 = RangeToText) to new format
// - Handles special "null" values by converting them to SpecialValue mappings
// - Preserves threshold colors when available
// - Consolidates multiple value mappings into a single ValueToText mapping
// - Maintains range mappings as separate RangeToText mappings
//
// Tooltip Options Migration:
// - Renames panel.options.tooltipOptions to panel.options.tooltip
// - Only applies to timeseries, xychart, and xychart2 panel types
// - Preserves all tooltip configuration options
//
// Example value mappings transformation:
//
// Before migration:
//
//	panel: {
//	  "fieldConfig": {
//	    "defaults": {
//	      "mappings": [
//	        { "id": 0, "text": "Up", "type": 1, "value": "1" },
//	        { "id": 1, "text": "Down", "type": 1, "value": "0" },
//	        { "from": "10", "to": "20", "text": "Medium", "type": 2 }
//	      ]
//	    }
//	  }
//	}
//
// After migration:
//
//	panel: {
//	  "fieldConfig": {
//	    "defaults": {
//	      "mappings": [
//	        {
//	          "type": "value",
//	          "options": {
//	            "1": { "text": "Up" },
//	            "0": { "text": "Down" }
//	          }
//	        },
//	        {
//	          "type": "range",
//	          "options": {
//	            "from": 10,
//	            "to": 20,
//	            "result": { "text": "Medium" }
//	          }
//	        }
//	      ]
//	    }
//	  }
//	}
//
// Example tooltip options transformation:
//
// Before migration:
//
//	panel: {
//	  "type": "timeseries",
//	  "options": {
//	    "tooltipOptions": { "mode": "multi" }
//	  }
//	}
//
// After migration:
//
//	panel: {
//	  "type": "timeseries",
//	  "options": {
//	    "tooltip": { "mode": "multi" }
//	  }
//	}
func V30(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 30

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		upgradeValueMappingsForPanel(panelMap)
		migrateTooltipOptions(panelMap)

		// Handle nested panels in collapsed rows
		nestedPanels, hasNested := panelMap["panels"].([]interface{})
		if !hasNested {
			continue
		}

		for _, nestedPanel := range nestedPanels {
			nestedPanelMap, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			upgradeValueMappingsForPanel(nestedPanelMap)
			migrateTooltipOptions(nestedPanelMap)
		}
	}

	return nil
}

// upgradeValueMappingsForPanel migrates value mappings from old format to new format
func upgradeValueMappingsForPanel(panel map[string]interface{}) {
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	if !ok {
		return
	}

	// Upgrade defaults mappings
	if defaults, ok := fieldConfig["defaults"].(map[string]interface{}); ok {
		if mappings, ok := defaults["mappings"].([]interface{}); ok {
			var thresholds map[string]interface{}
			if t, ok := defaults["thresholds"].(map[string]interface{}); ok {
				thresholds = t
			}
			defaults["mappings"] = upgradeValueMappings(mappings, thresholds)
		}
	}

	// Upgrade overrides mappings
	overrides, hasOverrides := fieldConfig["overrides"].([]interface{})
	if !hasOverrides {
		return
	}

	for _, override := range overrides {
		overrideMap, ok := override.(map[string]interface{})
		if !ok {
			continue
		}

		properties, hasProperties := overrideMap["properties"].([]interface{})
		if !hasProperties {
			continue
		}

		for _, property := range properties {
			propertyMap, ok := property.(map[string]interface{})
			if !ok {
				continue
			}

			if propertyMap["id"] != "mappings" {
				continue
			}

			mappings, ok := propertyMap["value"].([]interface{})
			if !ok {
				continue
			}

			propertyMap["value"] = upgradeValueMappings(mappings, nil)
		}
	}
}

// upgradeValueMappings converts legacy value mappings to new format
func upgradeValueMappings(oldMappings []interface{}, thresholds map[string]interface{}) []interface{} {
	if len(oldMappings) == 0 {
		return oldMappings
	}

	// Check if all mappings are already in the new format
	if areAllMappingsNewFormat(oldMappings) {
		return oldMappings
	}

	valueMaps := createValueMaps()
	var newMappings []interface{}
	hasValueMappings := false

	for _, mapping := range oldMappings {
		if mappingMap, ok := mapping.(map[string]interface{}); ok {
			if isNewFormatMapping(mappingMap) {
				hasValueMappings = processNewFormatMapping(mappingMap, valueMaps, &newMappings, hasValueMappings)
			} else {
				hasValueMappings = processLegacyMapping(mappingMap, thresholds, valueMaps, &newMappings, hasValueMappings)
			}
		}
	}

	// Add consolidated value mappings at the beginning if any exist
	if hasValueMappings {
		newMappings = append([]interface{}{valueMaps}, newMappings...)
	}

	return newMappings
}

// areAllMappingsNewFormat checks if all mappings are already in the new format
func areAllMappingsNewFormat(oldMappings []interface{}) bool {
	for _, mapping := range oldMappings {
		if mappingMap, ok := mapping.(map[string]interface{}); ok {
			if mappingType, ok := mappingMap["type"].(string); ok && mappingType != "" {
				// This is already in new format, keep it as-is
				continue
			} else {
				// Found a legacy format mapping, need to process
				return false
			}
		}
	}
	return true
}

// createValueMaps creates the base value maps structure
func createValueMaps() map[string]interface{} {
	return map[string]interface{}{
		"type":    "value",
		"options": map[string]interface{}{},
	}
}

// isNewFormatMapping checks if a mapping is already in the new format
func isNewFormatMapping(mappingMap map[string]interface{}) bool {
	if mappingType, ok := mappingMap["type"].(string); ok && mappingType != "" {
		return true
	}
	return false
}

// processNewFormatMapping handles mappings that are already in the new format
func processNewFormatMapping(mappingMap map[string]interface{}, valueMaps map[string]interface{}, newMappings *[]interface{}, hasValueMappings bool) bool {
	mappingType := mappingMap["type"].(string)
	if mappingType == "value" {
		// Consolidate existing value mappings
		if options, ok := mappingMap["options"].(map[string]interface{}); ok {
			valueMapsOptions := valueMaps["options"].(map[string]interface{})
			for k, v := range options {
				valueMapsOptions[k] = v
			}
			hasValueMappings = true
		}
	} else {
		*newMappings = append(*newMappings, mappingMap)
	}
	return hasValueMappings
}

// processLegacyMapping handles legacy format mappings
func processLegacyMapping(mappingMap map[string]interface{}, thresholds map[string]interface{}, valueMaps map[string]interface{}, newMappings *[]interface{}, hasValueMappings bool) bool {
	color := getColorFromThresholds(mappingMap, thresholds)

	// Convert legacy type numbers to new format
	if mappingType, ok := mappingMap["type"].(float64); ok {
		switch int(mappingType) {
		case 1: // ValueToText
			hasValueMappings = processValueToTextMapping(mappingMap, color, thresholds, valueMaps, newMappings, hasValueMappings)
		case 2: // RangeToText
			processRangeToTextMapping(mappingMap, color, newMappings)
		}
	}

	return hasValueMappings
}

// getColorFromThresholds extracts color from thresholds based on mapping text (matches frontend behavior)
func getColorFromThresholds(mappingMap map[string]interface{}, thresholds map[string]interface{}) interface{} {
	if thresholds == nil {
		return nil
	}

	// Try to get color from threshold based on the mapping text (matches frontend behavior)
	if text, ok := mappingMap["text"]; ok {
		if textStr, ok := text.(string); ok {
			if numeric, err := strconv.ParseFloat(textStr, 64); err == nil {
				return getActiveThresholdColor(numeric, thresholds)
			}
		}
	}

	return nil
}

// processValueToTextMapping handles ValueToText legacy mappings
func processValueToTextMapping(mappingMap map[string]interface{}, color interface{}, thresholds map[string]interface{}, valueMaps map[string]interface{}, newMappings *[]interface{}, hasValueMappings bool) bool {
	if value, ok := mappingMap["value"]; ok {
		if valueStr, ok := value.(string); ok && valueStr == "null" {
			// Handle null values as special value mapping
			processNullValueMapping(mappingMap, color, thresholds, newMappings)
		} else {
			// Regular value mapping
			processRegularValueMapping(mappingMap, value, color, valueMaps)
			hasValueMappings = true
		}
	}
	return hasValueMappings
}

// processNullValueMapping creates a special value mapping for null values
func processNullValueMapping(mappingMap map[string]interface{}, color interface{}, thresholds map[string]interface{}, newMappings *[]interface{}) {
	result := map[string]interface{}{
		"text": mappingMap["text"],
	}
	if color != nil {
		result["color"] = color
	}

	*newMappings = append(*newMappings, map[string]interface{}{
		"type": "special",
		"options": map[string]interface{}{
			"match":  "null",
			"result": result,
		},
	})
}

// processRegularValueMapping creates a regular value mapping
func processRegularValueMapping(mappingMap map[string]interface{}, value interface{}, color interface{}, valueMaps map[string]interface{}) {
	valueMapsOptions := valueMaps["options"].(map[string]interface{})
	result := map[string]interface{}{
		"text": mappingMap["text"],
	}
	if color != nil {
		result["color"] = color
	}
	valueMapsOptions[stringifyValue(value)] = result
}

// processRangeToTextMapping handles RangeToText legacy mappings
func processRangeToTextMapping(mappingMap map[string]interface{}, color interface{}, newMappings *[]interface{}) {
	result := map[string]interface{}{
		"text": mappingMap["text"],
	}
	if color != nil {
		result["color"] = color
	}

	from, _ := strconv.ParseFloat(stringifyValue(mappingMap["from"]), 64)
	to, _ := strconv.ParseFloat(stringifyValue(mappingMap["to"]), 64)

	*newMappings = append(*newMappings, map[string]interface{}{
		"type": "range",
		"options": map[string]interface{}{
			"from":   from,
			"to":     to,
			"result": result,
		},
	})
}

// getActiveThresholdColor returns the color for a value based on thresholds (matches frontend getActiveThreshold)
func getActiveThresholdColor(value float64, thresholds map[string]interface{}) interface{} {
	if steps, ok := thresholds["steps"].([]interface{}); ok {
		if len(steps) == 0 {
			return nil
		}

		var activeStep map[string]interface{}

		for _, step := range steps {
			if stepMap, ok := step.(map[string]interface{}); ok {
				if stepValue, ok := stepMap["value"]; ok {
					if stepValue == nil {
						// Null value represents negative infinity - this is always the base color
						activeStep = stepMap
						continue
					}

					if stepNum, ok := stepValue.(float64); ok {
						if value >= stepNum {
							activeStep = stepMap
						} else {
							break
						}
					}
				}
			}
		}

		if activeStep != nil {
			return activeStep["color"]
		}
	}

	return nil
}

// migrateTooltipOptions renames tooltipOptions to tooltip for specific panel types
func migrateTooltipOptions(panel map[string]interface{}) {
	panelType, ok := panel["type"].(string)
	if !ok {
		return
	}

	// Only migrate for specific panel types
	if panelType != "timeseries" && panelType != "xychart" && panelType != "xychart2" {
		return
	}

	options, ok := panel["options"].(map[string]interface{})
	if !ok {
		return
	}

	tooltipOptions, ok := options["tooltipOptions"]
	if !ok {
		return
	}

	// Rename tooltipOptions to tooltip
	options["tooltip"] = tooltipOptions
	delete(options, "tooltipOptions")
}

// stringifyValue converts a value to string
func stringifyValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case bool:
		return strconv.FormatBool(v)
	default:
		return ""
	}
}
