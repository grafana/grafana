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
type v28Migrator struct{}

func V28() SchemaVersionMigrationFunc {
	migrator := &v28Migrator{}

	return func(ctx context.Context, dashboard map[string]interface{}) error {
		return migrator.migrate(context.Background(), dashboard)
	}
}

func (m *v28Migrator) migrate(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 28

	// Migrate singlestat panels
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		if err := m.processPanels(panels); err != nil {
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

func (m *v28Migrator) processPanels(panels []interface{}) error {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				if err := m.processPanels(nestedPanels); err != nil {
					return err
				}
			}
			continue
		}

		// Migrate singlestat panels
		if p["type"] == "singlestat" || p["type"] == "grafana-singlestat-panel" {
			if err := m.migrateSinglestatPanel(p); err != nil {
				return err
			}
		}

		// Normalize existing stat panels to ensure they have current default options
		if p["type"] == "stat" {
			m.normalizeStatPanel(p)
		}
	}

	return nil
}

func (m *v28Migrator) migrateSinglestatPanel(panel map[string]interface{}) error {
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
	// This matches the frontend behavior where autoMigrateFrom is set in PanelModel.restoreModel
	originalType := panel["type"].(string)
	panel["autoMigrateFrom"] = panel["type"]
	panel["type"] = targetType
	panel["pluginVersion"] = "1.0.0" // FIXME... static version at this time

	// Migrate panel options and field config
	m.migrateSinglestatOptions(panel, originalType)

	return nil
}

// normalizeStatPanel ensures existing stat panels have all current default options
func (m *v28Migrator) normalizeStatPanel(panel map[string]interface{}) {
	if panel["options"] == nil {
		panel["options"] = map[string]interface{}{}
	}

	options := panel["options"].(map[string]interface{})

	// Apply missing default options that might not be present in older stat panels
	if _, exists := options["percentChangeColorMode"]; !exists {
		options["percentChangeColorMode"] = "standard"
	}

	// Ensure other critical defaults are present
	if _, exists := options["justifyMode"]; !exists {
		options["justifyMode"] = "auto"
	}

	if _, exists := options["textMode"]; !exists {
		options["textMode"] = "auto"
	}

	if _, exists := options["wideLayout"]; !exists {
		options["wideLayout"] = true
	}

	if _, exists := options["showPercentChange"]; !exists {
		options["showPercentChange"] = false
	}
}

// migrateSinglestatOptions handles the complete migration of singlestat panel options and field config
func (m *v28Migrator) migrateSinglestatOptions(panel map[string]interface{}, originalType string) {
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
	if originalType == "grafana-singlestat-panel" {
		m.migrateGrafanaSinglestatPanel(panel, defaults)
	} else {
		m.migratetSinglestat(panel, defaults)
	}

	// Apply shared migration logic
	m.applySharedSinglestatMigration(defaults)

	// Clean up old angular properties after migration
	m.cleanupAngularProperties(panel)
}

// getDefaultStatOptions returns the default options structure for stat panels
func (m *v28Migrator) getDefaultStatOptions() map[string]interface{} {
	return map[string]interface{}{
		"reduceOptions": map[string]interface{}{
			"calcs":  []string{"mean"},
			"fields": "",
			"values": false,
		},
		"orientation":            "horizontal",
		"justifyMode":            "auto",
		"percentChangeColorMode": "standard",
		"showPercentChange":      false,
		"textMode":               "auto",
		"wideLayout":             true,
	}
}

// migratetSinglestat handles explicit migration from 'singlestat' panels
// Based on explicit migration logic in DashboardMigrator.ts
func (m *v28Migrator) migratetSinglestat(panel map[string]interface{}, defaults map[string]interface{}) {
	angularOpts := m.extractAngularOptions(panel)

	// Explicit migration uses standard stat panel defaults
	options := m.getDefaultStatOptions()

	// Explicit migration: always set a reducer with fallback
	var valueName string
	if vn, ok := angularOpts["valueName"].(string); ok {
		valueName = vn
	}

	if reducer := m.getReducerForValueName(valueName); reducer != "" {
		options["reduceOptions"].(map[string]interface{})["calcs"] = []string{reducer}
	} else {
		// Explicit migration fallback: use mean for invalid reducers
		options["reduceOptions"].(map[string]interface{})["calcs"] = []string{"mean"}
	}

	// Migrate thresholds FIRST (consolidated: both panel types create DEFAULT_THRESHOLDS for empty strings)
	m.migrateThresholds(angularOpts, defaults)

	// If no thresholds were set from angular migration, add default stat panel thresholds
	// This matches the behavior of frontend pluginLoaded which adds default thresholds
	if _, hasThresholds := defaults["thresholds"]; !hasThresholds {
		defaults["thresholds"] = map[string]interface{}{
			"mode": "absolute",
			"steps": []interface{}{
				map[string]interface{}{
					"color": "green",
					"value": nil,
				},
				map[string]interface{}{
					"color": "red",
					"value": 80,
				},
			},
		}
	}

	// Apply common angular option migrations (value mappings can now use threshold colors)
	m.applyCommonAngularMigration(panel, defaults, options, angularOpts)

	panel["options"] = options
}

// migrateGrafanaSinglestatPanel handles auto-migration from 'grafana-singlestat-panel'
// Based on frontend changePlugin() and sharedSingleStatPanelChangedHandler logic
func (m *v28Migrator) migrateGrafanaSinglestatPanel(panel map[string]interface{}, defaults map[string]interface{}) {
	angularOpts := m.extractAngularOptions(panel)

	// Auto-migration uses different defaults (matches frontend changePlugin behavior)
	options := map[string]interface{}{
		"reduceOptions": map[string]interface{}{
			"calcs":  []string{"lastNotNull"}, // Auto-migration default
			"fields": "",
			"values": false,
		},
		"orientation":            "auto", // Auto-migration uses auto
		"justifyMode":            "auto",
		"percentChangeColorMode": "standard",
		"showPercentChange":      false,
		"textMode":               "auto",
		"wideLayout":             true,
	}

	// Auto-migration: only override if valid, otherwise keep default "lastNotNull"
	var valueName string
	if vn, ok := angularOpts["valueName"].(string); ok {
		valueName = vn
	}

	if reducer := m.getReducerForValueName(valueName); reducer != "" {
		options["reduceOptions"].(map[string]interface{})["calcs"] = []string{reducer}
	}
	// No fallback - keeps the auto-migration default "lastNotNull"

	// Migrate thresholds FIRST (consolidated: both panel types create DEFAULT_THRESHOLDS for empty strings)
	m.migrateThresholds(angularOpts, defaults)

	// If no thresholds were set from angular migration, add default stat panel thresholds
	// This matches the behavior of frontend pluginLoaded which adds default thresholds
	if _, hasThresholds := defaults["thresholds"]; !hasThresholds {
		defaults["thresholds"] = map[string]interface{}{
			"mode": "absolute",
			"steps": []interface{}{
				map[string]interface{}{
					"color": "green",
					"value": nil,
				},
				map[string]interface{}{
					"color": "red",
					"value": 80,
				},
			},
		}
	}

	// Apply common angular option migrations (value mappings can now use threshold colors)
	m.applyCommonAngularMigration(panel, defaults, options, angularOpts)

	panel["options"] = options
}

// migrateThresholds handles threshold migration for both singlestat panel types
// Both panel types now create DEFAULT_THRESHOLDS when threshold string is empty (consolidated behavior)
func (m *v28Migrator) migrateThresholds(angularOpts map[string]interface{}, defaults map[string]interface{}) {
	if thresholds, ok := angularOpts["thresholds"].(string); ok {
		if colors, ok := angularOpts["colors"].([]interface{}); ok {
			if thresholds != "" {
				// Non-empty thresholds: use normal migration
				m.migrateThresholdsAndColors(defaults, thresholds, colors)
			} else {
				// Empty thresholds: use frontend DEFAULT_THRESHOLDS fallback (both panel types)
				defaults["thresholds"] = map[string]interface{}{
					"mode": "absolute",
					"steps": []interface{}{
						map[string]interface{}{
							"color": "green",
							"value": nil,
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
func (m *v28Migrator) applyCommonAngularMigration(panel map[string]interface{}, defaults map[string]interface{}, options map[string]interface{}, angularOpts map[string]interface{}) {
	// Migrate table column
	// Based on sharedSingleStatPanelChangedHandler line ~125: options.reduceOptions.fields = `/^${prevPanel.tableColumn}$/`
	if tableColumn, ok := angularOpts["tableColumn"].(string); ok && tableColumn != "" {
		options["reduceOptions"].(map[string]interface{})["fields"] = "/^" + tableColumn + "$/"
	}

	// Migrate format to unit
	// Based on sharedSingleStatPanelChangedHandler line ~130: defaults.unit = prevPanel.format
	if format, ok := angularOpts["format"].(string); ok {
		defaults["unit"] = format
	}

	// Migrate decimals
	if decimals, ok := angularOpts["decimals"]; ok {
		defaults["decimals"] = decimals
	}

	// Migrate null point mode
	if nullPointMode, ok := angularOpts["nullPointMode"]; ok {
		defaults["nullValueMode"] = nullPointMode
	}

	// Migrate null text
	if nullText, ok := angularOpts["nullText"].(string); ok {
		defaults["noValue"] = nullText
	}

	// Migrate value mappings (thresholds should already be migrated)
	valueMaps, _ := angularOpts["valueMaps"].([]interface{})
	m.migrateValueMappings(angularOpts, defaults, valueMaps)

	// Migrate sparkline configuration
	// Based on statPanelChangedHandler lines ~25-35: sparkline migration logic
	if sparkline, ok := angularOpts["sparkline"].(map[string]interface{}); ok {
		if show, ok := sparkline["show"].(bool); ok && show {
			options["graphMode"] = "area"

			// Handle sparkline color
			// Based on statPanelChangedHandler lines ~30-35: sparkline lineColor handling
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

// applySharedSinglestatMigration applies shared migration logic for all singlestat panels
// Based on sharedSingleStatMigrationHandler in packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
func (m *v28Migrator) applySharedSinglestatMigration(defaults map[string]interface{}) {
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

func (m *v28Migrator) extractAngularOptions(panel map[string]interface{}) map[string]interface{} {
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
func (m *v28Migrator) getReducerForValueName(valueName string) string {
	reducerMap := map[string]string{
		"min":     "min",
		"max":     "max",
		"mean":    "mean",
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

func (m *v28Migrator) migrateThresholdsAndColors(defaults map[string]interface{}, thresholdsStr string, colors []interface{}) {
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
			step["value"] = nil
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

func (m *v28Migrator) migrateValueMappings(panel map[string]interface{}, defaults map[string]interface{}, valueMappings []interface{}) {
	mappings := []interface{}{}
	mappingType := panel["mappingType"]

	if mappingType == nil {
		if panel["valueMaps"] != nil && len(panel["valueMaps"].([]interface{})) > 0 {
			mappingType = 1
		} else if panel["rangeMaps"] != nil && len(panel["rangeMaps"].([]interface{})) > 0 {
			mappingType = 2
		}
	}

	switch mappingType {
	case 1:
		for _, valueMap := range valueMappings {
			valueMapping := valueMap.(map[string]interface{})
			upgradedMapping := m.upgradeOldAngularValueMapping(valueMapping, defaults["thresholds"])
			if upgradedMapping != nil {
				mappings = append(mappings, upgradedMapping)
			}
		}
	case 2:
		// Handle range mappings
		if rangeMaps, ok := panel["rangeMaps"].([]interface{}); ok {
			for _, rangeMap := range rangeMaps {
				rangeMapping := rangeMap.(map[string]interface{})
				upgradedMapping := m.upgradeOldAngularValueMapping(rangeMapping, defaults["thresholds"])
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
func (m *v28Migrator) upgradeOldAngularValueMapping(old map[string]interface{}, thresholds interface{}) map[string]interface{} {
	valueMaps := map[string]interface{}{
		"type":    "value",
		"options": map[string]interface{}{},
	}
	newMappings := []interface{}{}

	// Use the color we would have picked from thresholds
	var color interface{}
	if value, ok := old["value"]; ok {
		if numeric, err := m.parseNumericValue(value); err == nil {
			if thresholdsMap, ok := thresholds.(map[string]interface{}); ok {
				if steps, ok := thresholdsMap["steps"].([]interface{}); ok {
					level := m.getActiveThreshold(numeric, steps)
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
func (m *v28Migrator) getActiveThreshold(value float64, steps []interface{}) map[string]interface{} {
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
func (m *v28Migrator) parseNumericValue(value interface{}) (float64, error) {
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

// cleanupAngularProperties removes old angular properties after migration
// Based on PanelModel.clearPropertiesBeforePluginChange in public/app/features/dashboard/state/PanelModel.ts
func (m *v28Migrator) cleanupAngularProperties(panel map[string]interface{}) {
	// Remove PanelModel's autoMigrateFrom property
	delete(panel, "autoMigrateFrom")

	// Remove angular singlestat properties
	delete(panel, "valueName")
	delete(panel, "format")
	delete(panel, "decimals")
	delete(panel, "thresholds")
	delete(panel, "colors")
	delete(panel, "gauge")
	delete(panel, "sparkline")
	delete(panel, "colorBackground")
	delete(panel, "colorValue")
	delete(panel, "nullPointMode")
	delete(panel, "nullText")
	delete(panel, "valueMaps")
	delete(panel, "tableColumn")
	delete(panel, "angular")
	// Remove legacy options properties
	if options, ok := panel["options"].(map[string]interface{}); ok {
		delete(options, "valueOptions")
		delete(options, "thresholds")
		delete(options, "valueMaps")
		delete(options, "minValue")
		delete(options, "maxValue")
	}
}

// removeDeprecatedVariableProperties removes deprecated properties from variables
// Based on DashboardMigrator.ts v28 migration: variable property cleanup
func removeDeprecatedVariableProperties(variable map[string]interface{}) {
	// Remove deprecated properties
	delete(variable, "tags")
	delete(variable, "tagsQuery")
	delete(variable, "tagValuesQuery")
	delete(variable, "useTags")
}
