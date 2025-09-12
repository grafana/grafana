package schemaversion

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// V28 migrates singlestat panels to stat/gauge panels and removes deprecated variable properties.
//
// The migration performs two main tasks:
// 1. Migrates singlestat panels to either stat or gauge panels based on their configuration
// 2. Removes deprecated variable properties (tags, tagsQuery, tagValuesQuery, useTags)
//
// The migration includes comprehensive logic from the frontend:
// - Panel type migration (singlestat -> stat/gauge)
// - Field config migration with thresholds, mappings, and display options
// - Options migration including reduceOptions, orientation, and other panel-specific settings
// - Support for both angular singlestat and grafana-singlestat-panel migrations
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "type": "singlestat",
//	    "gauge": { "show": true },
//	    "targets": [{ "refId": "A" }]
//	  }
//	],
//	"templating": {
//	  "list": [
//	    { "name": "var1", "tags": ["tag1"], "tagsQuery": "query", "tagValuesQuery": "values", "useTags": true }
//	  ]
//	}
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "type": "gauge",
//	    "targets": [{ "refId": "A" }]
//	  }
//	],
//	"templating": {
//	  "list": [
//	    { "name": "var1" }
//	  ]
//	}
func V28(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 28

	// Migrate singlestat panels
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		if err := processPanels(panels); err != nil {
			return err
		}
	}

	// Remove deprecated variable properties
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		if list, ok := templating["list"].([]interface{}); ok {
			for _, v := range list {
				if variable, ok := v.(map[string]interface{}); ok {
					removeDeprecatedVariableProperties(variable)
				}
			}
		}
	}

	return nil
}

func processPanels(panels []interface{}) error {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				if err := processPanels(nestedPanels); err != nil {
					return err
				}
			}
			continue
		}

		// Migrate singlestat panels (including those already auto-migrated to stat)
		if p["type"] == "singlestat" || p["type"] == "grafana-singlestat-panel" ||
			p["autoMigrateFrom"] == "singlestat" || p["autoMigrateFrom"] == "grafana-singlestat-panel" {
			if err := migrateSinglestatPanel(p); err != nil {
				return err
			}
		}

		// Note: Panel defaults (including options object) are already applied
		// by applyPanelDefaults() in the main migration flow for ALL panels
		// No need for stat-specific normalization
	}

	return nil
}

func migrateSinglestatPanel(panel map[string]interface{}) error {
	targetType := "stat"

	// NOTE: The legacy types "singlestat" and "gauge" are both angular only
	// This are not supported by any version that could run this migration, so there is
	// no need to maintain a distinction or fallback to the non-stat version

	// NOTE: DashboardMigrator's migrateSinglestat function has some logic that never gets called
	// migrateSinglestat will only run if (panel.type === 'singlestat')
	// but this will not be the case because PanelModel runs restoreModel in the constructor
	// and since singlestat is in the autoMigrateAngular map, it will be migrated to stat,
	// and therefore migrateSinglestat will never run so this logic inside of it will never apply
	// if ((panel as any).gauge?.show) {
	// 	gaugePanelPlugin.meta = config.panels['gauge']
	// 	panel.changePlugin(gaugePanelPlugin)

	// Store original type for migration context (only for stat/gauge migration)
	// Set autoMigrateFrom to track the original type for proper migration logic
	originalType := panel["type"].(string)
	// Only set autoMigrateFrom if it doesn't already exist (preserve frontend defaults)
	if _, exists := panel["autoMigrateFrom"]; !exists {
		panel["autoMigrateFrom"] = originalType
	}
	panel["type"] = targetType
	panel["pluginVersion"] = pluginVersionForAutoMigrate

	// Migrate panel options and field config
	migrateSinglestatOptions(panel, originalType)

	return nil
}

// migrateSinglestatOptions handles the complete migration of singlestat panel options and field config
func migrateSinglestatOptions(panel map[string]interface{}, originalType string) {
	// Preserve important panel-level properties that should not be removed
	// These properties are preserved by the frontend's getSaveModel() method
	var maxDataPoints interface{}
	if mdp, exists := panel["maxDataPoints"]; exists {
		maxDataPoints = mdp
	}

	// Initialize field config if not present
	if panel["fieldConfig"] == nil {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	}

	fieldConfig := panel["fieldConfig"].(map[string]interface{})
	defaults := fieldConfig["defaults"].(map[string]interface{})

	// Migrate from angular singlestat configuration using appropriate strategy
	// Use autoMigrateFrom if available, otherwise use originalType
	migrationType := originalType
	if autoMigrateFrom, exists := panel["autoMigrateFrom"].(string); exists {
		migrationType = autoMigrateFrom
	}

	if migrationType == "grafana-singlestat-panel" {
		migrateGrafanaSinglestatPanel(panel, defaults)
	} else {
		migratetSinglestat(panel, defaults)
	}

	// Apply shared migration logic
	applySharedSinglestatMigration(defaults)

	// Apply complete stat panel defaults (matches frontend getPanelOptionsWithDefaults)
	// The frontend applies these defaults after migration via applyPluginOptionDefaults
	applyCompleteStatPanelDefaults(panel)

	// Create proper fieldConfig structure from defaults
	createFieldConfigFromDefaults(panel, defaults)

	// Restore preserved panel-level properties
	if maxDataPoints != nil {
		panel["maxDataPoints"] = maxDataPoints
	}

	// Clean up old angular properties after migration
	cleanupAngularProperties(panel)
}

// getDefaultStatOptions returns the default options structure for stat panels
// This matches the frontend's stat panel defaultOptions exactly
func getDefaultStatOptions() map[string]interface{} {
	// For now, return the explicit defaults until we integrate the centralized system
	return map[string]interface{}{
		"colorMode":              "value",
		"graphMode":              "area",
		"justifyMode":            "auto",
		"percentChangeColorMode": "standard",
		"showPercentChange":      false,
		"textMode":               "auto",
		"wideLayout":             true,
		"reduceOptions": map[string]interface{}{
			"calcs":  []string{"lastNotNull"}, // Matches frontend: ReducerID.lastNotNull
			"fields": "",
			"values": false,
		},
		"orientation": "auto",
	}
}

// migratetSinglestat handles explicit migration from 'singlestat' panels
// Based on frontend migrateFromAngularSinglestat function
func migratetSinglestat(panel map[string]interface{}, defaults map[string]interface{}) {
	angularOpts := extractAngularOptions(panel)

	// Extract valueName for reducer mapping (matches frontend migrateFromAngularSinglestat)
	var valueName string
	if vn, ok := angularOpts["valueName"].(string); ok {
		valueName = vn
	}

	// Set calcs based on valueName (matches frontend: calcs: [reducer ? reducer.id : ReducerID.mean])
	var calcs []string
	if reducer := getReducerForValueName(valueName); reducer != "" {
		calcs = []string{reducer}
	} else {
		// Use mean as fallback (matches frontend migrateFromAngularSinglestat: ReducerID.mean)
		calcs = []string{"mean"}
	}

	// Create options exactly like frontend migrateFromAngularSinglestat
	options := map[string]interface{}{
		"reduceOptions": map[string]interface{}{
			"calcs":  calcs,
			"fields": "",
			"values": false,
		},
		"orientation": "horizontal", // Matches frontend migrateFromAngularSinglestat: VizOrientation.Horizontal
	}

	// Migrate thresholds FIRST (consolidated: both panel types create DEFAULT_THRESHOLDS for empty strings)
	migrateThresholds(angularOpts, defaults)

	// If no thresholds were set from angular migration, add default stat panel thresholds
	// This matches the behavior of frontend pluginLoaded which adds default thresholds
	if _, hasThresholds := defaults["thresholds"]; !hasThresholds {
		defaults["thresholds"] = map[string]interface{}{
			"mode": "absolute",
			"steps": []interface{}{
				map[string]interface{}{
					"color": "green",
					"value": (*float64)(nil),
				},
				map[string]interface{}{
					"color": "red",
					"value": 80,
				},
			},
		}
	}

	// Apply common angular option migrations (value mappings can now use threshold colors)
	applyCommonAngularMigration(panel, defaults, options, angularOpts)

	// Merge new options with existing panel options to preserve properties like maxDataPoints
	if existingOptions, exists := panel["options"].(map[string]interface{}); exists {
		for key, value := range options {
			existingOptions[key] = value
		}
	} else {
		panel["options"] = options
	}
}

// migrateGrafanaSinglestatPanel handles auto-migration from 'grafana-singlestat-panel'
// Based on frontend autoMigrateAngular map: both singlestat and grafana-singlestat-panel migrate to stat
// However, the frontend only calls migrateFromAngularSinglestat for 'singlestat' panels.
// For 'grafana-singlestat-panel' panels, it uses the default stat panel options from getPanelOptionsWithDefaults.
// The frontend does NOT apply field config migration for grafana-singlestat-panel panels.
// Therefore, we only apply the stat panel defaults, not the field config migration.
func migrateGrafanaSinglestatPanel(panel map[string]interface{}, defaults map[string]interface{}) {
	// For grafana-singlestat-panel, the frontend uses default stat panel options
	// This means it uses ReducerID.lastNotNull as the default, not the valueName mapping
	// The frontend only applies valueName mapping for 'singlestat' panels via migrateFromAngularSinglestat

	// Create options with complete stat panel defaults (matches frontend getPanelOptionsWithDefaults)
	options := getDefaultStatOptions()

	// For grafana-singlestat-panel, the frontend does NOT apply field config migration
	// It only applies the stat panel defaults and basic threshold defaults
	// So we only add default thresholds, not the full field config migration

	// Add default stat panel thresholds and mappings (matches frontend behavior)
	defaults["thresholds"] = map[string]interface{}{
		"mode": "absolute",
		"steps": []interface{}{
			map[string]interface{}{
				"color": "green",
				"value": (*float64)(nil),
			},
			map[string]interface{}{
				"color": "red",
				"value": 80,
			},
		},
	}

	// Add empty mappings array (matches frontend behavior)
	defaults["mappings"] = []interface{}{}

	// Merge new options with existing panel options to preserve properties like maxDataPoints
	if existingOptions, exists := panel["options"].(map[string]interface{}); exists {
		for key, value := range options {
			existingOptions[key] = value
		}
	} else {
		panel["options"] = options
	}
}

// migrateThresholds handles threshold migration for both singlestat panel types
// Both panel types now create DEFAULT_THRESHOLDS when threshold string is empty (consolidated behavior)
func migrateThresholds(angularOpts map[string]interface{}, defaults map[string]interface{}) {
	if thresholds, ok := angularOpts["thresholds"].(string); ok {
		if colors, ok := angularOpts["colors"].([]interface{}); ok {
			if thresholds != "" {
				// Non-empty thresholds: use normal migration
				migrateThresholdsAndColors(defaults, thresholds, colors)
			} else {
				// Empty thresholds: use frontend DEFAULT_THRESHOLDS fallback (both panel types)
				defaults["thresholds"] = map[string]interface{}{
					"mode": "absolute",
					"steps": []interface{}{
						map[string]interface{}{
							"color": "green",
							"value": (*float64)(nil), // Use pointer to ensure field is present in JSON
						},
						map[string]interface{}{
							"color": "red",
							"value": 80,
						},
					},
				}
			}
		}
	}
}

// applyCommonAngularMigration applies migrations common to both singlestat types
func applyCommonAngularMigration(panel map[string]interface{}, defaults map[string]interface{}, options map[string]interface{}, angularOpts map[string]interface{}) {
	// Migrate table column
	// Based on sharedSingleStatPanelChangedHandler line ~125: options.reduceOptions.fields = `/^${prevPanel.tableColumn}$/`
	if tableColumn, ok := angularOpts["tableColumn"].(string); ok && tableColumn != "" {
		options["reduceOptions"].(map[string]interface{})["fields"] = "/^" + tableColumn + "$/"
	}

	// Migrate unit from format property (matches frontend sharedSingleStatPanelChangedHandler)
	if format, ok := angularOpts["format"].(string); ok {
		defaults["unit"] = format
	}

	// Migrate decimals
	if decimals, ok := angularOpts["decimals"]; ok {
		defaults["decimals"] = decimals
	}

	// Migrate nullPointMode to nullValueMode (matches frontend migrateFromAngularSinglestat)
	if nullPointMode, ok := angularOpts["nullPointMode"]; ok {
		defaults["nullValueMode"] = nullPointMode
	}

	// Migrate null text
	if nullText, ok := angularOpts["nullText"].(string); ok {
		defaults["noValue"] = nullText
	}

	// Migrate value mappings (thresholds should already be migrated)
	valueMaps, _ := angularOpts["valueMaps"].([]interface{})
	migrateValueMappings(angularOpts, defaults, valueMaps)

	// Migrate sparkline configuration
	// Based on statPanelChangedHandler lines ~25-35: sparkline migration logic
	if sparkline, ok := angularOpts["sparkline"].(map[string]interface{}); ok {
		if show, ok := sparkline["show"].(bool); ok && show {
			options["graphMode"] = "area"

			// Migrate sparkline lineColor to fieldConfig color
			if lineColor, ok := sparkline["lineColor"].(string); ok {
				defaults["color"] = map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": lineColor,
				}
			}
		} else {
			options["graphMode"] = "none"
		}
	} else {
		// Default to no graph mode if no sparkline configuration
		options["graphMode"] = "none"
	}

	// Migrate color configuration
	// Based on statPanelChangedHandler lines ~35-45: colorBackground and colorValue migration
	if colorBackground, ok := angularOpts["colorBackground"].(bool); ok && colorBackground {
		options["colorMode"] = "background"
	} else if colorValue, ok := angularOpts["colorValue"].(bool); ok && colorValue {
		options["colorMode"] = "value"
	} else {
		options["colorMode"] = "none"
	}

	// Migrate text mode
	// Based on statPanelChangedHandler lines ~45-47: valueName === 'name' migration
	if valueName, ok := angularOpts["valueName"].(string); ok && valueName == "name" {
		options["textMode"] = "name"
	}

	if angularOpts["gauge"] != nil && angularOpts["gauge"].(map[string]interface{})["show"] == true {
		defaults["min"] = angularOpts["gauge"].(map[string]interface{})["minValue"]
		defaults["max"] = angularOpts["gauge"].(map[string]interface{})["maxValue"]
	}
}

// applyCompleteStatPanelDefaults applies the complete stat panel defaults
// This matches the frontend's getPanelOptionsWithDefaults behavior after migration
func applyCompleteStatPanelDefaults(panel map[string]interface{}) {
	// Get or create options object
	options, exists := panel["options"].(map[string]interface{})
	if !exists {
		options = map[string]interface{}{}
		panel["options"] = options
	}

	// Apply complete stat panel defaults (matches frontend stat panel defaultOptions)
	defaultOptions := getDefaultStatOptions()

	// Merge defaults with existing options, but don't override existing values
	// This matches the frontend's getPanelOptionsWithDefaults behavior
	for key, defaultValue := range defaultOptions {
		if _, exists := options[key]; !exists {
			options[key] = defaultValue
		}
	}
}

// applySharedSinglestatMigration applies shared migration logic for all singlestat panels
// Based on sharedSingleStatMigrationHandler in packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
func applySharedSinglestatMigration(defaults map[string]interface{}) {
	// Ensure thresholds have proper structure
	if thresholds, ok := defaults["thresholds"].(map[string]interface{}); ok {
		if steps, ok := thresholds["steps"].([]interface{}); ok {
			// Ensure first threshold is -Infinity (represented as null in JSON)
			if len(steps) > 0 {
				if firstStep, ok := steps[0].(map[string]interface{}); ok {
					if firstStep["value"] == nil {
						firstStep["value"] = nil // Use null instead of -math.Inf(1)
					}
				}
			}
		}
	}

	// Handle percent/percentunit units
	// Based on sharedSingleStatMigrationHandler lines ~280-300: percent/percentunit min/max handling
	if unit, ok := defaults["unit"].(string); ok {
		switch unit {
		case "percent":
			if defaults["min"] == nil {
				defaults["min"] = 0
			}
			if defaults["max"] == nil {
				defaults["max"] = 100
			}
		case "percentunit":
			if defaults["min"] == nil {
				defaults["min"] = 0
			}
			if defaults["max"] == nil {
				defaults["max"] = 1
			}
		}
	}
}

// Helper functions

func extractAngularOptions(panel map[string]interface{}) map[string]interface{} {
	// Some panels might have angular options directly in the root
	// Check for common angular properties
	angularProps := []string{
		"valueName", "tableColumn", "format", "decimals", "nullPointMode", "nullText",
		"thresholds", "colors", "valueMaps", "gauge", "sparkline", "colorBackground", "colorValue",
	}
	for _, prop := range angularProps {
		if _, exists := panel[prop]; exists {
			return panel
		}
	}

	return map[string]interface{}{}
}

// getReducerForValueName returns the mapped reducer or empty string for invalid values
func getReducerForValueName(valueName string) string {
	reducerMap := map[string]string{
		"min":     "min",
		"max":     "max",
		"mean":    "mean",
		"avg":     "mean", // avg maps to mean
		"median":  "median",
		"sum":     "sum",
		"count":   "count",
		"first":   "firstNotNull",
		"last":    "lastNotNull",
		"name":    "lastNotNull",
		"current": "lastNotNull",
		"total":   "sum",
	}

	if reducer, ok := reducerMap[valueName]; ok {
		return reducer
	}

	return ""
}

func migrateThresholdsAndColors(defaults map[string]interface{}, thresholdsStr string, colors []interface{}) {
	// Parse thresholds string (e.g., "10,20,30")
	// Based on sharedSingleStatPanelChangedHandler lines ~145-165: Convert thresholds and color values
	thresholds := []interface{}{}
	thresholdValues := strings.Split(thresholdsStr, ",")

	// Create threshold steps
	for i, color := range colors {
		step := map[string]interface{}{
			"color": color,
		}

		if i == 0 {
			// Frontend expects explicit null value for first step, not omitted field
			// Use a pointer to ensure the field is present in JSON with null value
			var nullValue *float64
			step["value"] = nullValue
		} else if i-1 < len(thresholdValues) {
			if val, err := strconv.ParseFloat(strings.TrimSpace(thresholdValues[i-1]), 64); err == nil {
				step["value"] = val
			}
		}

		thresholds = append(thresholds, step)
	}

	defaults["thresholds"] = map[string]interface{}{
		"mode":  "absolute",
		"steps": thresholds,
	}
}

func migrateValueMappings(panel map[string]interface{}, defaults map[string]interface{}, valueMappings []interface{}) {
	mappings := []interface{}{}
	mappingType := panel["mappingType"]

	// Check for inconsistent mapping configuration
	// If panel has rangeMaps but mappingType is 1, or vice versa, fix it
	hasValueMaps := panel["valueMaps"] != nil && len(panel["valueMaps"].([]interface{})) > 0
	hasRangeMaps := panel["rangeMaps"] != nil && len(panel["rangeMaps"].([]interface{})) > 0

	if hasRangeMaps && mappingType == float64(1) {
		mappingType = 2
	} else if hasValueMaps && mappingType == float64(2) {
		mappingType = 1
	} else if mappingType == nil {
		if hasValueMaps {
			mappingType = 1
		} else if hasRangeMaps {
			mappingType = 2
		}
	}

	switch mappingType {
	case 1:
		for _, valueMap := range valueMappings {
			valueMapping := valueMap.(map[string]interface{})
			upgradedMapping := upgradeOldAngularValueMapping(valueMapping, defaults["thresholds"])
			if upgradedMapping != nil {
				mappings = append(mappings, upgradedMapping)
			}
		}
	case 2:
		// Handle range mappings
		if rangeMaps, ok := panel["rangeMaps"].([]interface{}); ok {
			for _, rangeMap := range rangeMaps {
				rangeMapping := rangeMap.(map[string]interface{})
				upgradedMapping := upgradeOldAngularValueMapping(rangeMapping, defaults["thresholds"])
				if upgradedMapping != nil {
					mappings = append(mappings, upgradedMapping)
				}
			}
		}
	}

	defaults["mappings"] = mappings
}

// upgradeOldAngularValueMapping converts old angular value mappings to new format
// Based on upgradeOldAngularValueMapping in packages/grafana-data/src/utils/valueMappings.ts
func upgradeOldAngularValueMapping(old map[string]interface{}, thresholds interface{}) map[string]interface{} {
	valueMaps := map[string]interface{}{
		"type":    "value",
		"options": map[string]interface{}{},
	}
	newMappings := []interface{}{}

	// Use the color we would have picked from thresholds
	// Frontend uses old.text to determine color, not old.value
	var color interface{}
	if text, ok := old["text"].(string); ok {
		if numeric, err := parseNumericValue(text); err == nil {
			if thresholdsMap, ok := thresholds.(map[string]interface{}); ok {
				if steps, ok := thresholdsMap["steps"].([]interface{}); ok {
					level := getActiveThreshold(numeric, steps)
					if level != nil {
						if levelColor, ok := level["color"]; ok {
							color = levelColor
						}
					}
				}
			}
		}
	}

	// Determine mapping type
	mappingType := old["type"]
	if mappingType == nil {
		// Try to guess from available properties
		if old["value"] != nil {
			mappingType = 1 // ValueToText
		} else if old["from"] != nil || old["to"] != nil {
			mappingType = 2 // RangeToText
		}
	}

	switch mappingType {
	case 1: // ValueToText
		if value, ok := old["value"]; ok && value != nil {
			if valueStr, ok := value.(string); ok && valueStr == "null" {
				newMappings = append(newMappings, map[string]interface{}{
					"type": "special",
					"options": map[string]interface{}{
						"match":  "null",
						"result": map[string]interface{}{"text": old["text"], "color": color},
					},
				})
			} else {
				valueMaps["options"].(map[string]interface{})[fmt.Sprintf("%v", value)] = map[string]interface{}{
					"text":  old["text"],
					"color": color,
				}
			}
		}
	case 2: // RangeToText
		from := old["from"]
		to := old["to"]
		if (from != nil && fmt.Sprintf("%v", from) == "null") || (to != nil && fmt.Sprintf("%v", to) == "null") {
			newMappings = append(newMappings, map[string]interface{}{
				"type": "special",
				"options": map[string]interface{}{
					"match":  "null",
					"result": map[string]interface{}{"text": old["text"], "color": color},
				},
			})
		} else {
			var fromVal, toVal interface{}
			if from != nil {
				if fromStr, ok := from.(string); ok {
					if fromFloat, err := strconv.ParseFloat(fromStr, 64); err == nil {
						fromVal = fromFloat
					}
				} else {
					fromVal = from
				}
			}
			if to != nil {
				if toStr, ok := to.(string); ok {
					if toFloat, err := strconv.ParseFloat(toStr, 64); err == nil {
						toVal = toFloat
					}
				} else {
					toVal = to
				}
			}

			newMappings = append(newMappings, map[string]interface{}{
				"type": "range",
				"options": map[string]interface{}{
					"from":   fromVal,
					"to":     toVal,
					"result": map[string]interface{}{"text": old["text"], "color": color},
				},
			})
		}
	}

	// Add valueMaps if it has options
	if len(valueMaps["options"].(map[string]interface{})) > 0 {
		newMappings = append([]interface{}{valueMaps}, newMappings...)
	}

	if len(newMappings) > 0 {
		return newMappings[0].(map[string]interface{})
	}

	return nil
}

// getActiveThreshold finds the active threshold for a given value
// Based on getActiveThreshold in packages/grafana-data/src/field/thresholds.ts
func getActiveThreshold(value float64, steps []interface{}) map[string]interface{} {
	for i := len(steps) - 1; i >= 0; i-- {
		if step, ok := steps[i].(map[string]interface{}); ok {
			if stepValue, ok := step["value"]; ok {
				if stepValue == nil {
					// First step with null value (represents -Infinity)
					return step
				}
				if stepFloat, ok := stepValue.(float64); ok && value >= stepFloat {
					return step
				}
			}
		}
	}
	return nil
}

// parseNumericValue converts various types to float64 for threshold calculations
func parseNumericValue(value interface{}) (float64, error) {
	switch v := value.(type) {
	case string:
		return strconv.ParseFloat(v, 64)
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case int64:
		return float64(v), nil
	default:
		return 0, fmt.Errorf("cannot convert %T to numeric value", value)
	}
}

// createFieldConfigFromDefaults creates the proper fieldConfig structure from defaults
// and removes all legacy properties from the panel
func createFieldConfigFromDefaults(panel map[string]interface{}, defaults map[string]interface{}) {
	// Ensure fieldConfig exists
	if panel["fieldConfig"] == nil {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	}

	fieldConfig := panel["fieldConfig"].(map[string]interface{})
	fieldDefaults := fieldConfig["defaults"].(map[string]interface{})

	// Copy all defaults to fieldConfig.defaults
	for key, value := range defaults {
		fieldDefaults[key] = value
	}

	// Note: Frontend doesn't add these extra fieldConfig defaults
	// Color is handled in sparkline migration logic
	// nullValueMode and unit are not added by frontend

	// Remove all legacy properties from the panel
	legacyProperties := []string{
		"colors", "thresholds", "valueMaps", "grid", "legend", "mappingTypes", "gauge",
		"autoMigrateFrom", "colorBackground", "colorValue", "format", "mappingType",
		"nullPointMode", "postfix", "postfixFontSize", "prefix",
		"prefixFontSize", "rangeMaps", "sparkline", "tableColumn", "valueFontSize",
		"valueName", "aliasYAxis", "bars", "dashLength", "dashes", "fill", "fillGradient",
		"lineInterpolation", "lineWidth", "pointRadius", "points", "spaceLength",
		"stack", "steppedLine", "xAxis", "yAxes", "yAxis", "zIndex",
	}

	for _, prop := range legacyProperties {
		delete(panel, prop)
	}
}

// cleanupAngularProperties removes old angular properties after migration
// Based on PanelModel.clearPropertiesBeforePluginChange in public/app/features/dashboard/state/PanelModel.ts
// This function removes ALL properties except those in mustKeepProps to match frontend behavior exactly
func cleanupAngularProperties(panel map[string]interface{}) {
	// Properties that must be kept (matching frontend mustKeepProps)
	mustKeepProps := map[string]bool{
		"id": true, "gridPos": true, "type": true, "title": true, "scopedVars": true,
		"repeat": true, "repeatPanelId": true, "repeatDirection": true, "repeatedByRow": true,
		"minSpan": true, "collapsed": true, "panels": true, "targets": true, "datasource": true,
		"timeFrom": true, "timeShift": true, "hideTimeOverride": true, "description": true,
		"links": true, "fullscreen": true, "isEditing": true, "isViewing": true,
		"hasRefreshed": true, "events": true, "cacheTimeout": true, "queryCachingTTL": true,
		"cachedPluginOptions": true, "transparent": true, "pluginVersion": true,
		"fieldConfig": true, "options": true, // These are set by migration
		"maxDataPoints": true, "interval": true, // Panel-level properties preserved by frontend
		"autoMigrateFrom": true, // Preserve autoMigrateFrom for proper migration logic
	}

	// Remove ALL properties except those in mustKeepProps (matching frontend behavior)
	for key := range panel {
		if !mustKeepProps[key] {
			delete(panel, key)
		}
	}

	// Ensure all targets have refIds (matching frontend ensureQueryIds behavior)
	ensureTargetRefIds(panel)
}

// ensureTargetRefIds assigns refIds to targets that don't have them
// This matches the frontend PanelModel.ensureQueryIds() behavior
func ensureTargetRefIds(panel map[string]interface{}) {
	targets, ok := panel["targets"].([]interface{})
	if !ok || len(targets) == 0 {
		return
	}

	// Find existing refIds
	existingRefIds := make(map[string]bool)
	for _, targetInterface := range targets {
		if target, ok := targetInterface.(map[string]interface{}); ok {
			if refId, ok := target["refId"].(string); ok {
				existingRefIds[refId] = true
			}
		}
	}

	// Assign refIds to targets that don't have them
	letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	letterIndex := 0

	for _, targetInterface := range targets {
		if target, ok := targetInterface.(map[string]interface{}); ok {
			refId, hasRefId := target["refId"].(string)
			if !hasRefId || refId == "" {
				// Find next available refId
				for letterIndex < len(letters) {
					refId := string(letters[letterIndex])
					if !existingRefIds[refId] {
						target["refId"] = refId
						existingRefIds[refId] = true
						break
					}
					letterIndex++
				}
				letterIndex++
			}
		}
	}
}

// removeDeprecatedVariableProperties removes deprecated properties from variables
// Based on DashboardMigrator.ts v28 migration: variable property cleanup
func removeDeprecatedVariableProperties(variable map[string]interface{}) {
	// Remove deprecated properties
	delete(variable, "tags")

	// Only remove tagsQuery if it's truthy (matches frontend behavior)
	if tagsQuery, exists := variable["tagsQuery"]; exists && tagsQuery != "" && tagsQuery != nil {
		delete(variable, "tagsQuery")
	}

	// Only remove tagValuesQuery if it's truthy (matches frontend behavior)
	if tagValuesQuery, exists := variable["tagValuesQuery"]; exists && tagValuesQuery != "" && tagValuesQuery != nil {
		delete(variable, "tagValuesQuery")
	}

	// Only remove useTags if it's truthy (matches frontend behavior)
	if useTags, exists := variable["useTags"]; exists && useTags != false && useTags != nil {
		delete(variable, "useTags")
	}
}
