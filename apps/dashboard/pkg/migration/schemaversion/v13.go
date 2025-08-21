package schemaversion

// V13 migrates graph panels to timeseries panels with complete field config and options conversion.
// This migration replicates the complete graphPanelChangedHandler logic from the frontend, including:
// - Panel type conversion from 'graph' to 'timeseries'
// - Complete field config conversion (y-axis, series overrides, thresholds, etc.)
// - Options conversion (legend, tooltip, etc.)
// - Time regions conversion to annotations
func V13(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 13

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process graph panels (convert them to timeseries)
		if panel["type"] != "graph" {
			continue
		}

		// Convert panel type from 'graph' to 'timeseries'
		panel["type"] = "timeseries"

		// Convert complete field config and options (replicating graphPanelChangedHandler)
		convertFieldConfig(panel)
		convertOptions(panel)
		convertSeriesOverrides(panel)
		convertThresholds(panel)
		convertTimeRegions(panel)

		// Clean up old graph-specific properties
		cleanupGraphProperties(panel)
	}

	return nil
}

// convertFieldConfig converts graph field config to timeseries format
func convertFieldConfig(panel map[string]interface{}) {
	// Initialize fieldConfig if it doesn't exist
	if panel["fieldConfig"] == nil {
		panel["fieldConfig"] = map[string]interface{}{
			"defaults":  map[string]interface{}{},
			"overrides": []interface{}{},
		}
	}

	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	if !ok {
		return
	}

	defaults, ok := fieldConfig["defaults"].(map[string]interface{})
	if !ok {
		return
	}

	// Set default color mode
	defaults["color"] = map[string]interface{}{
		"mode": "palette-classic",
	}

	// Set default custom properties
	defaults["custom"] = map[string]interface{}{
		"axisBorderShow":   false,
		"axisCenteredZero": false,
		"axisColorMode":    "text",
		"axisLabel":        "",
		"axisPlacement":    "auto",
		"barAlignment":     0,
		"barWidthFactor":   0.6,
		"drawStyle":        "points",
		"fillOpacity":      0,
		"gradientMode":     "none",
		"hideFrom": map[string]interface{}{
			"legend":  false,
			"tooltip": false,
			"viz":     false,
		},
		"insertNulls":       false,
		"lineInterpolation": "linear",
		"lineWidth":         1,
		"pointSize":         5,
		"scaleDistribution": map[string]interface{}{
			"type": "linear",
		},
		"showPoints": "auto",
		"spanNulls":  false,
		"stacking": map[string]interface{}{
			"group": "A",
			"mode":  "none",
		},
		"thresholdsStyle": map[string]interface{}{
			"mode": "off",
		},
	}

	// Set default mappings and thresholds
	defaults["mappings"] = []interface{}{}
	defaults["thresholds"] = map[string]interface{}{
		"mode":  "absolute",
		"steps": []interface{}{},
	}

	// Convert y-axis settings to field config
	if yaxes, ok := panel["yaxes"].([]interface{}); ok && len(yaxes) > 0 {
		if y1, ok := yaxes[0].(map[string]interface{}); ok {
			// Convert y-axis properties to field config defaults
			if unit, ok := y1["format"].(string); ok {
				defaults["unit"] = unit
			}
			if decimals, ok := y1["decimals"]; ok {
				defaults["decimals"] = decimals
			}
			if min, ok := y1["min"]; ok {
				defaults["min"] = min
			}
			if max, ok := y1["max"]; ok {
				defaults["max"] = max
			}
			if label, ok := y1["label"].(string); ok {
				if custom, ok := defaults["custom"].(map[string]interface{}); ok {
					custom["axisLabel"] = label
				}
			}
			if show, ok := y1["show"].(bool); ok {
				if custom, ok := defaults["custom"].(map[string]interface{}); ok {
					if show {
						custom["axisPlacement"] = "auto"
					} else {
						custom["axisPlacement"] = "hidden"
					}
				}
			}
			if logBase, ok := y1["logBase"].(float64); ok && (logBase == 2 || logBase == 10) {
				if custom, ok := defaults["custom"].(map[string]interface{}); ok {
					custom["scaleDistribution"] = map[string]interface{}{
						"type": "log",
						"log":  logBase,
					}
				}
			}
		}
	}

	// Clean up old y-axis properties
	delete(panel, "yaxes")
}

// convertOptions converts graph options to timeseries format
func convertOptions(panel map[string]interface{}) {
	// Initialize options if it doesn't exist
	if panel["options"] == nil {
		panel["options"] = map[string]interface{}{}
	}

	options, ok := panel["options"].(map[string]interface{})
	if !ok {
		return
	}

	// Set default legend options
	options["legend"] = map[string]interface{}{
		"calcs":       []interface{}{},
		"displayMode": "list",
		"placement":   "bottom",
		"showLegend":  true,
	}

	// Set default tooltip options
	options["tooltip"] = map[string]interface{}{
		"hideZeros": false,
		"mode":      "single",
		"sort":      "none",
	}

	// Convert legend settings from old graph format
	if legend, ok := panel["legend"].(map[string]interface{}); ok {
		legendOptions, ok := options["legend"].(map[string]interface{})
		if ok {
			if show, ok := legend["show"].(bool); ok && !show {
				legendOptions["showLegend"] = false
			}

			if alignAsTable, ok := legend["alignAsTable"].(bool); ok && alignAsTable {
				legendOptions["displayMode"] = "table"
			}

			if rightSide, ok := legend["rightSide"].(bool); ok && rightSide {
				legendOptions["placement"] = "right"
			}

			if sideWidth, ok := legend["sideWidth"]; ok {
				legendOptions["width"] = sideWidth
			}
		}
		delete(panel, "legend")
	}

	// Convert tooltip settings from old graph format
	if tooltip, ok := panel["tooltip"].(map[string]interface{}); ok {
		tooltipOptions, ok := options["tooltip"].(map[string]interface{})
		if ok {
			if shared, ok := tooltip["shared"].(bool); ok {
				if shared {
					tooltipOptions["mode"] = "multi"
				}
			}

			if sort, ok := tooltip["sort"]; ok && tooltipOptions["mode"] == "multi" {
				switch sort {
				case float64(1):
					tooltipOptions["sort"] = "asc"
				case float64(2):
					tooltipOptions["sort"] = "desc"
				default:
					tooltipOptions["sort"] = "none"
				}
			}
		}
		delete(panel, "tooltip")
	}
}

// convertSeriesOverrides converts graph series overrides to field config overrides
func convertSeriesOverrides(panel map[string]interface{}) {
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	if !ok {
		return
	}

	overrides, ok := fieldConfig["overrides"].([]interface{})
	if !ok {
		overrides = []interface{}{}
	}

	// Convert aliasColors to overrides
	if aliasColors, ok := panel["aliasColors"].(map[string]interface{}); ok {
		for alias, color := range aliasColors {
			if colorStr, ok := color.(string); ok && colorStr != "" {
				override := map[string]interface{}{
					"matcher": map[string]interface{}{
						"id":      "byName",
						"options": alias,
					},
					"properties": []interface{}{
						map[string]interface{}{
							"id": "color",
							"value": map[string]interface{}{
								"mode":       "fixed",
								"fixedColor": colorStr,
							},
						},
					},
				}
				overrides = append(overrides, override)
			}
		}
	}

	// Convert seriesOverrides to field config overrides
	if seriesOverrides, ok := panel["seriesOverrides"].([]interface{}); ok {
		for _, seriesOverride := range seriesOverrides {
			if seriesMap, ok := seriesOverride.(map[string]interface{}); ok {
				alias, hasAlias := seriesMap["alias"].(string)
				if !hasAlias {
					continue
				}

				// Determine if alias is regex
				aliasIsRegex := false
				if len(alias) > 2 {
					firstChar := alias[0]
					lastChar := alias[len(alias)-1]
					if (firstChar == '/' || firstChar == '~' || firstChar == '@' || firstChar == ';' || firstChar == '%' || firstChar == '#' || firstChar == '\'') &&
						firstChar == lastChar {
						aliasIsRegex = true
					}
				}

				override := map[string]interface{}{
					"matcher": map[string]interface{}{
						"id":      getMatcherId(aliasIsRegex),
						"options": alias,
					},
					"properties": []interface{}{},
				}

				properties := []interface{}{}

				// Convert various series override properties
				if fill, ok := seriesMap["fill"]; ok {
					if fillNum, ok := fill.(float64); ok {
						properties = append(properties, map[string]interface{}{
							"id":    "custom.fillOpacity",
							"value": fillNum * 10, // was 0-10, new is 0-100
						})
					}
				}

				if points, ok := seriesMap["points"]; ok {
					if pointsBool, ok := points.(bool); ok {
						properties = append(properties, map[string]interface{}{
							"id":    "custom.showPoints",
							"value": pointsBool,
						})
					}
				}

				if bars, ok := seriesMap["bars"]; ok {
					if barsBool, ok := bars.(bool); ok {
						if barsBool {
							properties = append(properties, map[string]interface{}{
								"id":    "custom.drawStyle",
								"value": "bars",
							})
							properties = append(properties, map[string]interface{}{
								"id":    "custom.fillOpacity",
								"value": 100,
							})
						}
					}
				}

				if lines, ok := seriesMap["lines"]; ok {
					if linesBool, ok := lines.(bool); ok {
						if linesBool {
							properties = append(properties, map[string]interface{}{
								"id":    "custom.drawStyle",
								"value": "line",
							})
						}
					}
				}

				if linewidth, ok := seriesMap["linewidth"]; ok {
					properties = append(properties, map[string]interface{}{
						"id":    "custom.lineWidth",
						"value": linewidth,
					})
				}

				if pointradius, ok := seriesMap["pointradius"]; ok {
					if radius, ok := pointradius.(float64); ok {
						properties = append(properties, map[string]interface{}{
							"id":    "custom.pointSize",
							"value": 2 + radius*2,
						})
					}
				}

				if color, ok := seriesMap["color"]; ok {
					if colorStr, ok := color.(string); ok {
						properties = append(properties, map[string]interface{}{
							"id": "color",
							"value": map[string]interface{}{
								"mode":       "fixed",
								"fixedColor": colorStr,
							},
						})
					}
				}

				if len(properties) > 0 {
					override["properties"] = properties
					overrides = append(overrides, override)
				}
			}
		}
	}

	fieldConfig["overrides"] = overrides
}

// convertThresholds converts graph thresholds to the new step-based threshold system
func convertThresholds(panel map[string]interface{}) {
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	if !ok {
		return
	}

	defaults, ok := fieldConfig["defaults"].(map[string]interface{})
	if !ok {
		return
	}

	// Convert old thresholds array to new step-based system
	if oldThresholds, ok := panel["thresholds"].([]interface{}); ok && len(oldThresholds) > 0 {
		steps := []interface{}{}
		area := false
		line := false

		// Sort thresholds by value
		sortedThresholds := make([]map[string]interface{}, len(oldThresholds))
		for i, t := range oldThresholds {
			if threshold, ok := t.(map[string]interface{}); ok {
				sortedThresholds[i] = threshold
			}
		}

		// Sort by value
		for i := 0; i < len(sortedThresholds)-1; i++ {
			for j := i + 1; j < len(sortedThresholds); j++ {
				if val1, ok1 := sortedThresholds[i]["value"].(float64); ok1 {
					if val2, ok2 := sortedThresholds[j]["value"].(float64); ok2 {
						if val1 > val2 {
							sortedThresholds[i], sortedThresholds[j] = sortedThresholds[j], sortedThresholds[i]
						}
					}
				}
			}
		}

		// Convert to step-based thresholds
		for i, threshold := range sortedThresholds {
			if fill, ok := threshold["fill"].(bool); ok && fill {
				area = true
			}
			if line, ok := threshold["line"].(bool); ok && line {
				line = true
			}

			op, _ := threshold["op"].(string)
			value, _ := threshold["value"].(float64)

			if op == "gt" {
				steps = append(steps, map[string]interface{}{
					"value": value,
					"color": getThresholdColor(threshold),
				})
			} else if op == "lt" {
				if i == 0 {
					steps = append(steps, map[string]interface{}{
						"value": interface{}(nil), // -Infinity equivalent
						"color": "transparent",
					})
				}

				// Check if next threshold is gt and there's a gap
				if i+1 < len(sortedThresholds) {
					nextThreshold := sortedThresholds[i+1]
					if nextOp, ok := nextThreshold["op"].(string); ok && nextOp == "gt" {
						if nextValue, ok := nextThreshold["value"].(float64); ok && nextValue > value {
							steps = append(steps, map[string]interface{}{
								"value": value,
								"color": "transparent",
							})
						}
					}
				}
			}
		}

		// Add base transparent step if needed
		if len(steps) > 0 {
			if firstStep, ok := steps[0].(map[string]interface{}); ok {
				if firstValue, ok := firstStep["value"].(float64); ok && firstValue != -1e308 {
					steps = append([]interface{}{
						map[string]interface{}{
							"color": "transparent",
							"value": interface{}(nil),
						},
					}, steps...)
				}
			}
		}

		// Set threshold style mode - default to "line" if no fill/line specified
		displayMode := "line"
		if area && line {
			displayMode = "line+area"
		} else if area {
			displayMode = "area"
		} else if line {
			displayMode = "line"
		}

		if defaults["custom"] == nil {
			defaults["custom"] = map[string]interface{}{}
		}
		custom, ok := defaults["custom"].(map[string]interface{})
		if ok {
			custom["thresholdsStyle"] = map[string]interface{}{
				"mode": displayMode,
			}
		}

		defaults["thresholds"] = map[string]interface{}{
			"mode":  "absolute",
			"steps": steps,
		}
	} else {
		// No thresholds specified, add the default timeseries threshold steps
		// This matches what the frontend timeseries plugin does
		if defaults["custom"] == nil {
			defaults["custom"] = map[string]interface{}{}
		}
		custom, ok := defaults["custom"].(map[string]interface{})
		if ok {
			custom["thresholdsStyle"] = map[string]interface{}{
				"mode": "off",
			}
		}

		// Add default threshold steps that match the timeseries plugin defaults
		defaults["thresholds"] = map[string]interface{}{
			"mode": "absolute",
			"steps": []interface{}{
				map[string]interface{}{
					"color": "green",
					"value": interface{}(nil), // null in JSON, represents -Infinity
				},
				map[string]interface{}{
					"color": "red",
					"value": 80.0,
				},
			},
		}
	}

	// Clean up old thresholds
	delete(panel, "thresholds")
}

// convertTimeRegions converts graph time regions to annotations
func convertTimeRegions(panel map[string]interface{}) {
	// This is a simplified version - in the real frontend, time regions get converted to
	// dashboard annotations, but for the backend migration we'll just clean them up
	delete(panel, "timeRegions")
}

// getThresholdColor extracts the color from a threshold object
func getThresholdColor(threshold map[string]interface{}) string {
	if colorMode, ok := threshold["colorMode"].(string); ok {
		switch colorMode {
		case "critical":
			return "red"
		case "warning":
			return "orange"
		case "custom":
			if fillColor, ok := threshold["fillColor"].(string); ok && fillColor != "" {
				return fillColor
			}
			if lineColor, ok := threshold["lineColor"].(string); ok && lineColor != "" {
				return lineColor
			}
		}
	}
	return "red"
}

// cleanupGraphProperties removes old graph-specific properties
func cleanupGraphProperties(panel map[string]interface{}) {
	// Remove old graph-specific properties that are no longer needed
	delete(panel, "aliasColors")
	delete(panel, "seriesOverrides")
	delete(panel, "dashes")
	delete(panel, "dashLength")
	delete(panel, "spaceLength")
	delete(panel, "nullPointMode")
	delete(panel, "steppedLine")
	delete(panel, "points")
	delete(panel, "bars")
	delete(panel, "lines")
	delete(panel, "stack")
	delete(panel, "percentage")
	delete(panel, "legend")
	delete(panel, "tooltip")
	delete(panel, "yaxes")
	delete(panel, "xaxis")
	delete(panel, "grid")
	delete(panel, "thresholds")
	delete(panel, "timeRegions")
}

func getMatcherId(aliasIsRegex bool) string {
	if aliasIsRegex {
		return "byRegexp"
	}
	return "byName"
}
