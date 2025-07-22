package schemaversion

import (
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
func V28(panelProvider PanelPluginInfoProvider) SchemaVersionMigrationFunc {
	panelPlugins := panelProvider.GetPanels()

	return func(dashboard map[string]interface{}) error {
		dashboard["schemaVersion"] = 28

		// Migrate singlestat panels
		if panels, ok := dashboard["panels"].([]interface{}); ok {
			processPanelsV28(panels, panelPlugins)
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
}

// processPanelsV28 recursively processes panels, including nested panels within rows
func processPanelsV28(panels []interface{}, panelPlugins []PanelPluginInfo) {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				processPanelsV28(nestedPanels, panelPlugins)
			}
			continue
		}

		// Migrate singlestat panels
		if p["type"] == "singlestat" || p["type"] == "grafana-singlestat-panel" {
			migrateSinglestatPanel(p, panelPlugins)
		}
	}
}

// migrateSinglestatPanel migrates a singlestat panel to a stat panel
func migrateSinglestatPanel(panel map[string]interface{}, panelPlugins []PanelPluginInfo) {
	originalType := panel["type"].(string)
	targetType := "stat"

	// Check if grafana-singlestat-panel plugin exists
	for _, info := range panelPlugins {
		if info.ID == "grafana-singlestat-panel" {
			panel["type"] = "grafana-singlestat-panel"
			// Note: autoMigrateFrom is NOT set when migrating to grafana-singlestat-panel
			// This matches the frontend behavior in migrateSinglestat function
			return
		}
	}

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
	panel["autoMigrateFrom"] = originalType
	panel["type"] = targetType

	// Migrate panel options and field config
	migrateSinglestatOptions(panel, originalType, targetType)
}

// migrateSinglestatOptions handles the complete migration of singlestat panel options and field config
func migrateSinglestatOptions(panel map[string]interface{}, originalType string, targetType string) {
	// Initialize field config if not present
	if panel["fieldConfig"] == nil {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	}

	fieldConfig := panel["fieldConfig"].(map[string]interface{})
	defaults := fieldConfig["defaults"].(map[string]interface{})

	// Handle angular singlestat migration
	switch originalType {
	case "singlestat":
		// Migrate from angular singlestat configuration
		migrateFromAngularSinglestat(panel, defaults, targetType)
	case "grafana-singlestat-panel":
		// Migrate from grafana-singlestat-panel
		migrateFromGrafanaSinglestat(panel, defaults)
	}

	// Apply shared migration logic
	applySharedSinglestatMigration(defaults)

	// Clean up old angular properties after migration
	cleanupAngularProperties(panel, originalType)
}

// migrateFromAngularSinglestat handles migration from angular singlestat panels
// Based on sharedSingleStatPanelChangedHandler in packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
// and statPanelChangedHandler in public/app/plugins/panel/stat/StatMigrations.ts
func migrateFromAngularSinglestat(panel map[string]interface{}, defaults map[string]interface{}, targetType string) {
	// Extract angular options
	angularOpts := extractAngularOptions(panel)
	if angularOpts == nil {
		return
	}

	// Set up basic options
	options := map[string]interface{}{
		"reduceOptions": map[string]interface{}{
			"calcs": []string{"mean"}, // Default to mean, will be updated below
		},
		"orientation": "horizontal",
	}

	// Migrate value name to reducer
	// Based on sharedSingleStatPanelChangedHandler line ~117: const reducer = fieldReducers.getIfExists(prevPanel.valueName)
	if valueName, ok := angularOpts["valueName"].(string); ok {
		reducer := getReducerForValueName(valueName)
		options["reduceOptions"].(map[string]interface{})["calcs"] = []string{reducer}
	}

	// Migrate table column
	// Based on sharedSingleStatPanelChangedHandler line ~125: options.reduceOptions.fields = `/^${prevPanel.tableColumn}$/`
	if tableColumn, ok := angularOpts["tableColumn"].(string); ok {
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

	// Migrate thresholds and colors
	if thresholds, ok := angularOpts["thresholds"].(string); ok {
		if colors, ok := angularOpts["colors"].([]interface{}); ok {
			migrateThresholdsAndColors(defaults, thresholds, colors)
		}
	}

	// Migrate value mappings
	if valueMappings, ok := angularOpts["valueMappings"].([]interface{}); ok {
		migrateValueMappings(defaults, valueMappings)
	}

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

	// Update panel options
	panel["options"] = options
}

// migrateFromGrafanaSinglestat handles migration from grafana-singlestat-panel
// Based on sharedSingleStatMigrationHandler in packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
func migrateFromGrafanaSinglestat(panel map[string]interface{}, defaults map[string]interface{}) {
	// For grafana-singlestat-panel, we need to handle the options structure differently
	// This panel type typically has a more modern structure that needs less transformation

	// Set up basic options
	options := map[string]interface{}{
		"reduceOptions": map[string]interface{}{
			"calcs": []string{"mean"},
		},
		"orientation": "horizontal",
	}

	// Migrate existing options if present
	if existingOptions, ok := panel["options"].(map[string]interface{}); ok {
		// Migrate value options
		if valueOptions, ok := existingOptions["valueOptions"].(map[string]interface{}); ok {
			if unit, ok := valueOptions["unit"].(string); ok {
				defaults["unit"] = unit
			}
			if decimals, ok := valueOptions["decimals"]; ok {
				defaults["decimals"] = decimals
			}
			if stat, ok := valueOptions["stat"].(string); ok {
				reducer := getReducerForValueName(stat)
				options["reduceOptions"].(map[string]interface{})["calcs"] = []string{reducer}
			}
		}

		// Migrate thresholds
		if thresholds, ok := existingOptions["thresholds"].([]interface{}); ok {
			migrateThresholdsArray(defaults, thresholds)
		}

		// Migrate value mappings
		if valueMappings, ok := existingOptions["valueMappings"].([]interface{}); ok {
			migrateValueMappings(defaults, valueMappings)
		}

		// Migrate min/max values
		if minValue, ok := existingOptions["minValue"]; ok {
			defaults["min"] = minValue
		}
		if maxValue, ok := existingOptions["maxValue"]; ok {
			defaults["max"] = maxValue
		}
	}

	// Update panel options
	panel["options"] = options
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
	// Handle different angular options structures
	if angular, ok := panel["angular"].(map[string]interface{}); ok {
		return angular
	}

	// Some panels might have angular options directly in the root
	// Check for common angular properties
	angularProps := []string{"valueName", "format", "decimals", "thresholds", "colors", "gauge", "sparkline"}
	for _, prop := range angularProps {
		if _, exists := panel[prop]; exists {
			return panel
		}
	}

	return nil
}

func getReducerForValueName(valueName string) string {
	// Map value names to reducer IDs
	// Based on fieldReducers mapping in @grafana/data and sharedSingleStatPanelChangedHandler
	reducerMap := map[string]string{
		"min":     "min",
		"max":     "max",
		"avg":     "mean",
		"mean":    "mean",
		"median":  "median",
		"sum":     "sum",
		"count":   "count",
		"first":   "firstNotNull",
		"last":    "lastNotNull",
		"name":    "lastNotNull", // For name, we typically want the last value
		"current": "lastNotNull",
		"total":   "sum",
	}

	if reducer, ok := reducerMap[valueName]; ok {
		return reducer
	}

	return "mean" // Default fallback
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
			step["value"] = nil // Use null instead of -math.Inf(1)
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

func migrateThresholdsArray(defaults map[string]interface{}, thresholds []interface{}) {
	// Ensure thresholds have proper structure
	steps := []interface{}{}
	for i, threshold := range thresholds {
		if step, ok := threshold.(map[string]interface{}); ok {
			// Ensure value is not null
			if step["value"] == nil && i == 0 {
				step["value"] = nil // Use null for the first step
			}
			steps = append(steps, step)
		}
	}

	if len(steps) > 0 {
		defaults["thresholds"] = map[string]interface{}{
			"mode":  "absolute",
			"steps": steps,
		}
	}
}

func migrateValueMappings(defaults map[string]interface{}, valueMappings []interface{}) {
	// Convert old value mappings to new format
	// Based on convertOldAngularValueMappings in @grafana/data and sharedSingleStatPanelChangedHandler
	mappings := []interface{}{}

	for _, mapping := range valueMappings {
		if m, ok := mapping.(map[string]interface{}); ok {
			// Convert old mapping format to new format
			newMapping := map[string]interface{}{
				"type": m["type"],
			}

			// Handle different mapping types
			switch m["type"] {
			case 1: // Value to text
				newMapping["options"] = map[string]interface{}{
					"mappings": []interface{}{
						map[string]interface{}{
							"value": m["value"],
							"text":  m["text"],
						},
					},
				}
			case 2: // Range to text
				newMapping["options"] = map[string]interface{}{
					"from":   m["from"],
					"to":     m["to"],
					"result": map[string]interface{}{"text": m["text"]},
				}
			}

			mappings = append(mappings, newMapping)
		}
	}

	if len(mappings) > 0 {
		defaults["mappings"] = mappings
	}
}

// cleanupAngularProperties removes old angular properties after migration
// Based on PanelModel.clearPropertiesBeforePluginChange in public/app/features/dashboard/state/PanelModel.ts
func cleanupAngularProperties(panel map[string]interface{}, originalType string) {
	switch originalType {
	case "singlestat":
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
		delete(panel, "valueMappings")
		delete(panel, "tableColumn")
		delete(panel, "angular")
	case "grafana-singlestat-panel":
		// Remove grafana-singlestat-panel properties
		if options, ok := panel["options"].(map[string]interface{}); ok {
			delete(options, "valueOptions")
			delete(options, "thresholds")
			delete(options, "valueMappings")
			delete(options, "minValue")
			delete(options, "maxValue")
		}
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
