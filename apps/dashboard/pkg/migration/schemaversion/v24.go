package schemaversion

import (
	"strconv"
)

// V24 migration migrates the angular table panel to the standard table panel
// In the frontend, this is an auto-migration meaning that this angular panel is always migrated to table panel.
// The backend replicates the complete frontend auto-migration logic since it cannot rely on frontend auto-migration.
//
// This migration performs:
// 1. Converts 'styles' array to 'fieldConfig' with 'defaults' and 'overrides'
// 2. Migrates thresholds and colors to new threshold format
// 3. Converts column-specific styles to field overrides
// 4. Migrates transformations from old format to new transformation system
// 5. Handles various style properties: unit, decimals, alignment, color modes, links, date formatting, hidden columns
// 6. Removes deprecated properties: styles, transform, columns

// Example 1: Basic table with defaults
// Before migration:
// {
//     "panels": [
//         {
//             "id": 1,
//             "type": "table",
//             "title": "Basic Table",
//             "styles": [
//                 {
//                     "pattern": "/.*/",
//                     "thresholds": ["10", "20", "30"],
//                     "colors": ["green", "yellow", "red"],
//                     "unit": "bytes",
//                     "decimals": 2
//                 }
//             ],
//             "targets": [{ "refId": "A" }]
//         }
//     ]
// }
//
// After migration:
// {
//     "panels": [
//         {
//             "id": 1,
//             "type": "table",
//             "title": "Basic Table",
//             "fieldConfig": {
//                 "defaults": {
//                     "unit": "bytes",
//                     "decimals": 2,
//                     "custom": {},
//                     "thresholds": {
//                         "mode": "absolute",
//                         "steps": [
//                             { "color": "green", "value": null },
//                             { "color": "green", "value": 10 },
//                             { "color": "yellow", "value": 20 },
//                             { "color": "red", "value": 30 }
//                         ]
//                     }
//                 },
//                 "overrides": []
//             },
//             "transformations": [],
//             "targets": [{ "refId": "A" }],
//             "pluginVersion": "1.0.0"
//         }
//     ]
// }

// Example 2: Complex table with overrides and transformations
// Before migration:
// {
//     "panels": [
//         {
//             "id": 2,
//             "type": "table",
//             "title": "Complex Table",
//             "styles": [
//                 {
//                     "pattern": "/.*/",
//                     "unit": "percent",
//                     "align": "center",
//                     "colorMode": "cell"
//                 },
//                 {
//                     "pattern": "Status",
//                     "alias": "Current Status",
//                     "colorMode": "value",
//                     "align": "left"
//                 },
//                 {
//                     "pattern": "/Error.*/",
//                     "link": true,
//                     "linkUrl": "http://example.com/errors",
//                     "linkTooltip": "View errors",
//                     "linkTargetBlank": true
//                 },
//                 {
//                     "pattern": "Time",
//                     "type": "date",
//                     "dateFormat": "YYYY-MM-DD HH:mm:ss",
//                     "alias": "Timestamp"
//                 },
//                 {
//                     "pattern": "Hidden",
//                     "type": "hidden"
//                 }
//             ],
//             "transform": "timeseries_aggregations",
//             "columns": [
//                 { "value": "avg", "text": "Average" },
//                 { "value": "max", "text": "Maximum" }
//             ],
//             "targets": [{ "refId": "A" }]
//         }
//     ]
// }
//
// After migration:
// {
//     "panels": [
//         {
//             "id": 2,
//             "type": "table",
//             "title": "Complex Table",
//             "fieldConfig": {
//                 "defaults": {
//                     "unit": "percent",
//                     "custom": {
//                         "align": "center",
//                         "cellOptions": { "type": "color-background" }
//                     }
//                 },
//                 "overrides": [
//                     {
//                         "matcher": { "id": "byName", "options": "Status" },
//                         "properties": [
//                             { "id": "displayName", "value": "Current Status" },
//                             { "id": "custom.cellOptions", "value": { "type": "color-text" } },
//                             { "id": "custom.align", "value": "left" }
//                         ]
//                     },
//                     {
//                         "matcher": { "id": "byRegexp", "options": "/Error.*/" },
//                         "properties": [
//                             {
//                                 "id": "links",
//                                 "value": [{
//                                     "title": "View errors",
//                                     "url": "http://example.com/errors",
//                                     "targetBlank": true
//                                 }]
//                             }
//                         ]
//                     },
//                     {
//                         "matcher": { "id": "byName", "options": "Time" },
//                         "properties": [
//                             { "id": "displayName", "value": "Timestamp" },
//                             { "id": "unit", "value": "time: YYYY-MM-DD HH:mm:ss" }
//                         ]
//                     },
//                     {
//                         "matcher": { "id": "byName", "options": "Hidden" },
//                         "properties": [
//                             { "id": "custom.hideFrom.viz", "value": true }
//                         ]
//                     }
//                 ]
//             },
//             "transformations": [
//                 {
//                     "id": "reduce",
//                     "options": {
//                         "reducers": ["mean", "max"],
//                         "includeTimeField": false
//                     }
//                 }
//             ],
//             "targets": [{ "refId": "A" }],
//             "pluginVersion": "1.0.0"
//         }
//     ]
// }

type v24Migrator struct {
	panelProvider PanelPluginInfoProvider
	panelPlugins  []PanelPluginInfo
}

func V24(panelProvider PanelPluginInfoProvider) SchemaVersionMigrationFunc {
	migrator := &v24Migrator{
		panelProvider: panelProvider,
		panelPlugins:  panelProvider.GetPanels(),
	}

	return migrator.migrate
}

func (m *v24Migrator) migrate(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 24

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		wasAngularTable := panelMap["type"] == "table"
		wasReactTable := panelMap["table"] == "table2"

		if wasAngularTable && panelMap["styles"] == nil {
			continue
		}

		if !wasAngularTable || wasReactTable {
			continue
		}

		// Find if the panel plugin exists
		tablePanelPlugin := m.panelProvider.GetPanelPlugin("table")
		if tablePanelPlugin.ID == "" {
			return NewMigrationError("table panel plugin not found when migrating dashboard to schema version 24", 24, LATEST_VERSION)
		}
		panelMap["pluginVersion"] = tablePanelPlugin.Version
		err := tablePanelChangedHandler(panelMap)
		if err != nil {
			return err
		}
	}

	return nil
}

func tablePanelChangedHandler(panel map[string]interface{}) error {
	prevOptions := getOptionsToRemember(panel)

	transformations := migrateTransformations(panel, prevOptions)

	prevDefaults := findDefaultStyle(prevOptions)
	defaults := migrateDefaults(prevDefaults)

	overrides := findNonDefaultStyles(prevOptions)

	if len(overrides) == 0 {
		overrides = []interface{}{}
	}

	panel["transformations"] = transformations
	panel["fieldConfig"] = map[string]interface{}{
		"defaults":  defaults,
		"overrides": overrides,
	}

	// Add default table panel options to match frontend behavior
	panel["options"] = map[string]interface{}{
		"cellHeight": "sm",
		"footer": map[string]interface{}{
			"countRows": false,
			"fields":    "",
			"reducer":   []interface{}{"sum"},
			"show":      false,
		},
		"showHeader": true,
	}

	// ensure that footer is migrated to v2
	migrateFooterV2(panel)

	// Remove deprecated properties
	delete(panel, "styles")
	delete(panel, "transform")
	delete(panel, "columns")

	return nil
}

// findDefaultStyle finds the style with pattern '/.*/' (default style)
func findDefaultStyle(prevOptions map[string]interface{}) map[string]interface{} {
	if styles, ok := prevOptions["styles"].([]interface{}); ok {
		for _, style := range styles {
			if styleMap, ok := style.(map[string]interface{}); ok {
				if pattern, ok := styleMap["pattern"].(string); ok && pattern == "/.*/" {
					return styleMap
				}
			}
		}
	}
	return nil
}

// findNonDefaultStyles finds all styles that don't have pattern '/.*/'
func findNonDefaultStyles(prevOptions map[string]interface{}) []interface{} {
	var overrides []interface{}

	if styles, ok := prevOptions["styles"].([]interface{}); ok {
		for _, style := range styles {
			if styleMap, ok := style.(map[string]interface{}); ok {
				if pattern, ok := styleMap["pattern"].(string); ok && pattern != "/.*/" {
					override := migrateTableStyleToOverride(styleMap)
					overrides = append(overrides, override)
				}
			}
		}
	}
	return overrides
}

// migrateTransformations converts old table transformations to new format
func migrateTransformations(panel map[string]interface{}, oldOpts map[string]interface{}) []interface{} {
	transformations := []interface{}{}
	if existing, ok := panel["transformations"].([]interface{}); ok {
		transformations = existing
	}

	// Check if oldOpts has a transform that we can map
	if transform, ok := oldOpts["transform"].(string); ok {
		if newTransformID, exists := transformsMap[transform]; exists {
			opts := map[string]interface{}{
				"reducers": []interface{}{},
			}

			// Handle timeseries_aggregations specifically
			if transform == "timeseries_aggregations" {
				opts["includeTimeField"] = false

				// Map columns to reducers
				if columns, ok := oldOpts["columns"].([]interface{}); ok {
					var reducers []interface{}
					for _, column := range columns {
						if columnMap, ok := column.(map[string]interface{}); ok {
							if value, ok := columnMap["value"].(string); ok {
								if reducer, exists := columnsMap[value]; exists {
									reducers = append(reducers, reducer)
								}
							}
						}
					}
					opts["reducers"] = reducers
				}
			}

			// Add the transformation
			transformation := map[string]interface{}{
				"id":      newTransformID,
				"options": opts,
			}
			transformations = append(transformations, transformation)
		}
	}

	return transformations
}

// transformsMap maps old transform names to new transformation IDs
var transformsMap = map[string]string{
	"timeseries_to_rows":      "seriesToRows",
	"timeseries_to_columns":   "seriesToColumns",
	"timeseries_aggregations": "reduce",
	"table":                   "merge",
}

// columnsMap maps old column values to new reducer names
var columnsMap = map[string]string{
	"avg":     "mean",
	"min":     "min",
	"max":     "max",
	"total":   "sum",
	"current": "lastNotNull",
	"count":   "count",
}

// migrateTableStyleToOverride converts a table style to a field config override
func migrateTableStyleToOverride(style map[string]interface{}) map[string]interface{} {
	pattern, _ := style["pattern"].(string)

	// Determine field matcher ID based on pattern
	fieldMatcherID := "byName"
	if pattern != "" && len(pattern) >= 2 && pattern[0] == '/' && pattern[len(pattern)-1] == '/' {
		fieldMatcherID = "byRegexp"
	}

	override := map[string]interface{}{
		"matcher": map[string]interface{}{
			"id":      fieldMatcherID,
			"options": pattern,
		},
		"properties": []interface{}{},
	}

	properties := override["properties"].([]interface{})

	// Add display name
	if alias, ok := style["alias"].(string); ok && alias != "" {
		properties = append(properties, map[string]interface{}{
			"id":    "displayName",
			"value": alias,
		})
	}

	// Add unit
	if unit, ok := style["unit"].(string); ok && unit != "" {
		properties = append(properties, map[string]interface{}{
			"id":    "unit",
			"value": unit,
		})
	}

	// Add decimals
	if decimals, ok := style["decimals"].(float64); ok {
		properties = append(properties, map[string]interface{}{
			"id":    "decimals",
			"value": int(decimals),
		})
	} else if decimals, ok := style["decimals"].(int); ok {
		properties = append(properties, map[string]interface{}{
			"id":    "decimals",
			"value": decimals,
		})
	}

	// Handle date type
	if styleType, ok := style["type"].(string); ok && styleType == "date" {
		if dateFormat, ok := style["dateFormat"].(string); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "unit",
				"value": "time: " + dateFormat,
			})
		}
	}

	// Handle hidden type
	if styleType, ok := style["type"].(string); ok && styleType == "hidden" {
		properties = append(properties, map[string]interface{}{
			"id":    "custom.hideFrom.viz",
			"value": true,
		})
	}

	// Handle links
	if link, ok := style["link"].(bool); ok && link {
		linkTooltip, _ := style["linkTooltip"].(string)
		linkUrl, _ := style["linkUrl"].(string)
		linkTargetBlank, _ := style["linkTargetBlank"].(bool)

		properties = append(properties, map[string]interface{}{
			"id": "links",
			"value": []interface{}{
				map[string]interface{}{
					"title":       linkTooltip,
					"url":         linkUrl,
					"targetBlank": linkTargetBlank,
				},
			},
		})
	}

	// Handle color mode
	if colorMode, ok := style["colorMode"].(string); ok && colorMode != "" {
		if newColorMode, exists := colorModeMap[colorMode]; exists {
			properties = append(properties, map[string]interface{}{
				"id": "custom.cellOptions",
				"value": map[string]interface{}{
					"type": newColorMode,
				},
			})
		}
	}

	// Handle alignment
	if align, ok := style["align"].(string); ok && align != "" {
		alignValue := align
		if align == "auto" {
			alignValue = ""
		}
		properties = append(properties, map[string]interface{}{
			"id":    "custom.align",
			"value": alignValue,
		})
	}

	// Handle thresholds
	if thresholds, ok := style["thresholds"].([]interface{}); ok && len(thresholds) > 0 {
		if colors, ok := style["colors"].([]interface{}); ok && len(colors) > 0 {
			steps := generateThresholds(thresholds, colors)
			properties = append(properties, map[string]interface{}{
				"id": "thresholds",
				"value": map[string]interface{}{
					"mode":  "absolute",
					"steps": steps,
				},
			})
		}
	}

	override["properties"] = properties
	return override
}

// migrateDefaults converts default table styles to field config defaults
func migrateDefaults(prevDefaults map[string]interface{}) map[string]interface{} {
	defaults := map[string]interface{}{
		"custom": map[string]interface{}{
			"align": "auto",
			"cellOptions": map[string]interface{}{
				"type": "auto",
			},
			"inspect": false,
			"footer": map[string]interface{}{
				"reducer": []interface{}{},
			},
		},
		"mappings": []interface{}{},
	}

	// Add default thresholds for all table panels to match frontend behavior
	// The frontend applies the table panel's default field config which includes thresholds
	hasThresholds := false
	if prevDefaults != nil {
		if thresholds, ok := prevDefaults["thresholds"].([]interface{}); ok && len(thresholds) > 0 {
			hasThresholds = true
		}
	}

	// Add default thresholds for all table panels (when prevDefaults exists) without existing thresholds
	if !hasThresholds {
		defaults["thresholds"] = map[string]interface{}{
			"mode": "absolute",
			"steps": []interface{}{
				map[string]interface{}{"color": "green"},
				map[string]interface{}{"color": "red", "value": 80},
			},
		}
	}

	if prevDefaults == nil {
		return defaults
	}

	if unit, ok := prevDefaults["unit"].(string); ok && unit != "" {
		defaults["unit"] = unit
	}

	if decimals, ok := prevDefaults["decimals"].(float64); ok {
		defaults["decimals"] = int(decimals)
	}

	if alias, ok := prevDefaults["alias"].(string); ok && alias != "" {
		defaults["displayName"] = alias
	}

	if align, ok := prevDefaults["align"].(string); ok && align != "" {
		alignValue := align
		if align == "auto" {
			alignValue = ""
		}
		defaults["custom"].(map[string]interface{})["align"] = alignValue
	}

	if thresholds, ok := prevDefaults["thresholds"].([]interface{}); ok && len(thresholds) > 0 {
		if colors, ok := prevDefaults["colors"].([]interface{}); ok && len(colors) > 0 {
			steps := generateThresholds(thresholds, colors)
			defaults["thresholds"] = map[string]interface{}{
				"mode":  "absolute",
				"steps": steps,
			}
		}
	}

	if colorMode, ok := prevDefaults["colorMode"].(string); ok && colorMode != "" {
		if newColorMode, exists := colorModeMap[colorMode]; exists {
			defaults["custom"].(map[string]interface{})["cellOptions"] = map[string]interface{}{
				"type": newColorMode,
			}
		}
	}

	return defaults
}

func generateThresholds(thresholds []interface{}, colors []interface{}) []interface{} {
	steps := []interface{}{}

	// Add the base step (equivalent to -Infinity)
	var baseColor interface{} = "red" // default fallback
	if len(colors) > 0 && colors[0] != nil {
		baseColor = colors[0]
	}

	steps = append(steps, map[string]interface{}{
		"color": baseColor,
		"value": nil,
	})

	// Add threshold steps
	for i, threshold := range thresholds {
		var color interface{}
		// Use colors[i+1] for the i-th threshold (colors[0] was used for base step)
		if i+1 < len(colors) && colors[i+1] != nil {
			color = colors[i+1]
		} else {
			color = "red"
		}

		var value float64
		switch v := threshold.(type) {
		case string:
			if parsed, err := strconv.ParseFloat(v, 64); err == nil {
				value = parsed
			}
		case float64:
			value = v
		case int:
			value = float64(v)
		}

		steps = append(steps, map[string]interface{}{
			"color": color,
			"value": value,
		})
	}

	return steps
}

// port of the frontend footer migration
func migrateFooterV2(panel map[string]interface{}) {
	options, ok := panel["options"].(map[string]interface{})
	if !ok {
		return
	}
	oldFooter := options["footer"]

	if oldFooter != nil {
		footerMap, ok := oldFooter.(map[string]interface{})
		if ok && footerMap["show"] == true {
			reducers, _ := footerMap["reducer"].([]interface{})

			// Set footer reducer in defaults.custom
			fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
			if !ok {
				return
			}
			defaults, ok := fieldConfig["defaults"].(map[string]interface{})
			if !ok {
				return
			}
			custom, ok := defaults["custom"].(map[string]interface{})
			if !ok {
				custom = map[string]interface{}{}
				defaults["custom"] = custom
			}
			custom["footer"] = map[string]interface{}{
				"reducer": reducers,
			}

			// If countRows and reducer is ["count"], set to ["countAll"]
			if footerMap["countRows"] == true && len(reducers) > 0 && reducers[0] == "count" {
				custom["footer"] = map[string]interface{}{
					"reducer": []string{"countAll"},
				}
			}

			// If fields present, add override and remove footer from defaults.custom
			if fields, ok := footerMap["fields"].([]interface{}); ok && len(fields) > 0 {
				delete(custom, "footer")

				names := make([]string, len(fields))
				for i, f := range fields {
					names[i], _ = f.(string)
				}

				override := map[string]interface{}{
					"matcher": map[string]interface{}{
						"id": "byNames", // FieldMatcherID.byNames
						"options": map[string]interface{}{
							"mode":  "include", // ByNamesMatcherMode.include
							"names": names,
						},
					},
					"properties": []map[string]interface{}{
						{
							"id":    "custom.footer.reducer",
							"value": reducers,
						},
					},
				}
				overrides, ok := fieldConfig["overrides"].([]interface{})
				if !ok {
					overrides = []interface{}{}
				}
				fieldConfig["overrides"] = append(overrides, override)
			}

			// Remove footer from options
			delete(options, "footer")
		}
	}
}

var colorModeMap = map[string]string{
	"cell":  "color-background",
	"row":   "color-background",
	"value": "color-text",
}
