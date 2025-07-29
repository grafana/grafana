package schemaversion

import (
	"strconv"
)

// V24 migration migrates the angular table panel to the standard table panel
// In the frontend, this is an auto-migration meaning that this angular panel is always migrated to table panel.

// Example before migration:
// {
//     "panels": [
//         {
//             "id": 1,
//             "type": "table",
//             "title": "Table Panel",
//             "legend": true,
//             "styles": [
//                 { "thresholds": ["10", "20", "30"] },
//                 { "colors": ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"] },
//                 { "pattern": "/.*/" }
//             ],
//             "targets": [{ "refId": "A" }, {}]
//         }
//     ]
// }

// Example after migration:
// "panels": [
//     {
//       "fieldConfig": {
//         "defaults": {
//           "custom": {},
//           "thresholds": {
//             "mode": "absolute",
//             "steps": [
//               {
//                 "color": "red",
//                 "value": null
//               },
//               {
//                 "color": "red",
//                 "value": 10
//               },
//               {
//                 "color": "yellow",
//                 "value": 20
//               },
//               {
//                 "color": "green",
//                 "value": 30
//               }
//             ]
//           }
//         },
//         "overrides": []
//       },
//       "id": 1,
//       "legend": true,
//       "pluginVersion": "1.0.0",
//       "targets": [
//         {
//           "refId": "A"
//         }
//       ],
//       "transformations": [],
//       "type": "table"
//     }
//   ]

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

	// Remove deprecated styles property
	delete(panel, "styles")

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
			"id":    "custom.hidden",
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
		"custom": map[string]interface{}{},
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
	steps := []interface{}{
		map[string]interface{}{
			// -Infinity equivalent - assign a default color
			"color": "red",
			"value": nil,
		},
	}

	for i, threshold := range thresholds {
		var color interface{}
		if i < len(colors) && colors[i] != nil {
			color = colors[i]
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

var colorModeMap = map[string]string{
	"cell":  "color-background",
	"row":   "color-background",
	"value": "color-text",
}
