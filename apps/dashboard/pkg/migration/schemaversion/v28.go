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
type v28Migrator struct {
	panelProvider PanelPluginInfoProvider
	panelPlugins  []PanelPluginInfo
}

func V28(panelProvider PanelPluginInfoProvider) SchemaVersionMigrationFunc {
	migrator := &v28Migrator{
		panelProvider: panelProvider,
		panelPlugins:  panelProvider.GetPanels(),
	}

	return migrator.migrate
}

func (m *v28Migrator) migrate(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 28

	// Migrate singlestat panels
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		m.processPanels(panels)
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

func (m *v28Migrator) processPanels(panels []interface{}) {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				m.processPanels(nestedPanels)
			}
			continue
		}

		// Migrate singlestat panels
		if p["type"] == "singlestat" || p["type"] == "grafana-singlestat-panel" {
			m.migrateSinglestatPanel(p)
		}
	}
}

func (m *v28Migrator) migrateSinglestatPanel(panel map[string]interface{}) {
	targetType := "stat"

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
	panel["autoMigrateFrom"] = panel["type"]
	panel["type"] = targetType

	// get stat panel plugin from panelPlugins array
	statPanelPlugin := m.panelProvider.GetPanelPlugin("stat")
	panel["pluginVersion"] = statPanelPlugin.Version

	// Migrate panel options and field config
	m.migrateSinglestatOptions(panel, targetType)
}

// migrateSinglestatOptions handles the complete migration of singlestat panel options and field config
func (m *v28Migrator) migrateSinglestatOptions(panel map[string]interface{}, targetType string) {
	// Initialize field config if not present
	if panel["fieldConfig"] == nil {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	}

	fieldConfig := panel["fieldConfig"].(map[string]interface{})
	defaults := fieldConfig["defaults"].(map[string]interface{})

	// Handle different panel types
	originalType := panel["autoMigrateFrom"].(string)
	switch originalType {
	case "singlestat":
		// Migrate from angular singlestat configuration
		m.migrateFromAngularSinglestat(panel, defaults, targetType)
	case "grafana-singlestat-panel":
		// Migrate from grafana-singlestat-panel
		m.migrateFromGrafanaSinglestat(panel, defaults)
	}

	// Apply shared migration logic
	m.applySharedSinglestatMigration(defaults)

	// Clean up old angular properties after migration
	m.cleanupAngularProperties(panel)
}

// migrateFromGrafanaSinglestat handles migration from grafana-singlestat-panel
// Based on sharedSingleStatMigrationHandler in packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
func (m *v28Migrator) migrateFromGrafanaSinglestat(panel map[string]interface{}, defaults map[string]interface{}) {
	// Set up basic options
	options := m.getDefaultStatOptions()

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
				reducer := m.getReducerForValueName(stat)
				options["reduceOptions"].(map[string]interface{})["calcs"] = []string{reducer}
			}
		}

		// Migrate thresholds
		if thresholds, ok := existingOptions["thresholds"].([]interface{}); ok {
			m.migrateThresholdsArray(defaults, thresholds)
		}

		// Migrate value mappings
		valueMappings, _ := existingOptions["valueMappings"].([]interface{})
		valueMaps, _ := existingOptions["valueMaps"].([]interface{})

		// Use valueMaps if available, otherwise use valueMappings
		if len(valueMaps) > 0 {
			m.migrateValueMappings(defaults, valueMaps)
		} else {
			m.migrateValueMappings(defaults, valueMappings)
		}

		// Migrate min/max values
		if minValue, ok := existingOptions["minValue"]; ok {
			defaults["min"] = minValue
		}
		if maxValue, ok := existingOptions["maxValue"]; ok {
			defaults["max"] = maxValue
		}
	} else {
		// Ensure mappings array exists even if no existing options
		defaults["mappings"] = []interface{}{}
	}

	// Update panel options
	panel["options"] = options
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

// migrateFromAngularSinglestat handles migration from angular singlestat panels
// Based on sharedSingleStatPanelChangedHandler in packages/grafana-ui/src/components/SingleStatShared/SingleStatBaseOptions.ts
// and statPanelChangedHandler in public/app/plugins/panel/stat/StatMigrations.ts
func (m *v28Migrator) migrateFromAngularSinglestat(panel map[string]interface{}, defaults map[string]interface{}, targetType string) {
	// Extract angular options
	angularOpts := m.extractAngularOptions(panel)
	if angularOpts == nil {
		return
	}

	// Set up basic options
	options := m.getDefaultStatOptions()

	// Migrate value name to reducer
	// Based on sharedSingleStatPanelChangedHandler line ~117: const reducer = fieldReducers.getIfExists(prevPanel.valueName)
	if valueName, ok := angularOpts["valueName"].(string); ok {
		reducer := m.getReducerForValueName(valueName)
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
			m.migrateThresholdsAndColors(defaults, thresholds, colors)
		}
	}

	// Migrate value mappings
	valueMappings, _ := angularOpts["valueMappings"].([]interface{})
	valueMaps, _ := angularOpts["valueMaps"].([]interface{})

	// Use valueMaps if available, otherwise use valueMappings
	if len(valueMaps) > 0 {
		m.migrateValueMappings(defaults, valueMaps)
	} else {
		m.migrateValueMappings(defaults, valueMappings)
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

func (m *v28Migrator) getReducerForValueName(valueName string) string {
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

func (m *v28Migrator) migrateThresholdsArray(defaults map[string]interface{}, thresholds []interface{}) {
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

func (m *v28Migrator) migrateValueMappings(defaults map[string]interface{}, valueMappings []interface{}) {
	mappings := []interface{}{}

	for _, raw := range valueMappings {
		mapping, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}

		// Only handle op="=" style mappings
		if op, hasOp := mapping["op"].(string); hasOp && op == "=" {
			valueStr, ok := mapping["value"].(string)
			if !ok {
				continue
			}

			text, hasText := mapping["text"]
			if !hasText {
				continue
			}

			option := map[string]interface{}{
				"text": text,
			}

			if color, hasColor := mapping["color"].(string); hasColor {
				option["color"] = color
			}

			mappingEntry := map[string]interface{}{
				"type": "value",
				"options": map[string]interface{}{
					valueStr: option,
				},
			}

			mappings = append(mappings, mappingEntry)
			continue
		}

		// fallback for other mapping formats
		if typ, hasType := mapping["type"]; hasType {
			newMapping := map[string]interface{}{
				"type": typ,
			}

			switch typ {
			case 1: // value to text
				newMapping["options"] = map[string]interface{}{
					"mappings": []interface{}{
						map[string]interface{}{
							"value": mapping["value"],
							"text":  mapping["text"],
						},
					},
				}
			case 2: // range to text
				newMapping["options"] = map[string]interface{}{
					"from":   mapping["from"],
					"to":     mapping["to"],
					"result": map[string]interface{}{"text": mapping["text"]},
				}
			}

			mappings = append(mappings, newMapping)
		}
	}

	defaults["mappings"] = mappings
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
	delete(panel, "valueMappings")
	delete(panel, "tableColumn")
	delete(panel, "angular")
	// Remove legacy options properties
	if options, ok := panel["options"].(map[string]interface{}); ok {
		delete(options, "valueOptions")
		delete(options, "thresholds")
		delete(options, "valueMappings")
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
