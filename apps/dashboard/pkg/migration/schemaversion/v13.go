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
	overrides = convertAliasColors(panel, overrides)

	// Convert seriesOverrides to field config overrides
	overrides = convertSeriesOverridesToFieldConfig(panel, overrides)

	fieldConfig["overrides"] = overrides
}

func convertAliasColors(panel map[string]interface{}, overrides []interface{}) []interface{} {
	if aliasColors, ok := panel["aliasColors"].(map[string]interface{}); ok {
		for alias, color := range aliasColors {
			if colorStr, ok := color.(string); ok && colorStr != "" {
				override := createColorOverride(alias, colorStr)
				overrides = append(overrides, override)
			}
		}
	}
	return overrides
}

func createColorOverride(alias, colorStr string) map[string]interface{} {
	return map[string]interface{}{
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
}

func convertSeriesOverridesToFieldConfig(panel map[string]interface{}, overrides []interface{}) []interface{} {
	if seriesOverrides, ok := panel["seriesOverrides"].([]interface{}); ok {
		for _, seriesOverride := range seriesOverrides {
			if seriesMap, ok := seriesOverride.(map[string]interface{}); ok {
				override := createSeriesOverride(seriesMap)
				if override != nil {
					overrides = append(overrides, override)
				}
			}
		}
	}
	return overrides
}

func createSeriesOverride(seriesMap map[string]interface{}) map[string]interface{} {
	alias, hasAlias := seriesMap["alias"].(string)
	if !hasAlias {
		return nil
	}

	aliasIsRegex := isAliasRegex(alias)
	properties := extractSeriesProperties(seriesMap)

	if len(properties) == 0 {
		return nil
	}

	return map[string]interface{}{
		"matcher": map[string]interface{}{
			"id":      getMatcherId(aliasIsRegex),
			"options": alias,
		},
		"properties": properties,
	}
}

func isAliasRegex(alias string) bool {
	if len(alias) <= 2 {
		return false
	}

	firstChar := alias[0]
	lastChar := alias[len(alias)-1]

	regexChars := []byte{'/', '~', '@', ';', '%', '#', '\''}
	for _, char := range regexChars {
		if firstChar == char && firstChar == lastChar {
			return true
		}
	}
	return false
}

func extractSeriesProperties(seriesMap map[string]interface{}) []interface{} {
	properties := []interface{}{}

	// Fill opacity
	if fill, ok := seriesMap["fill"]; ok {
		if fillNum, ok := fill.(float64); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.fillOpacity",
				"value": fillNum * 10, // was 0-10, new is 0-100
			})
		}
	}

	// Fill below to
	if fillBelowTo, ok := seriesMap["fillBelowTo"]; ok {
		if fillBelowToVal, ok := fillBelowTo.(float64); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.fillBelowTo",
				"value": fillBelowToVal,
			})
		}
	}

	// Fill gradient
	if fillGradient, ok := seriesMap["fillGradient"]; ok {
		if fillGradientVal, ok := fillGradient.(float64); ok && fillGradientVal > 0 {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.fillGradient",
				"value": "opacity",
			})
			properties = append(properties, map[string]interface{}{
				"id":    "custom.fillOpacity",
				"value": fillGradientVal * 10,
			})
		}
	}

	// Show points
	if points, ok := seriesMap["points"]; ok {
		if pointsBool, ok := points.(bool); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.showPoints",
				"value": pointsBool,
			})
		}
	}

	// Show values
	if showValues, ok := seriesMap["showValues"]; ok {
		if showValuesBool, ok := showValues.(bool); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.showValues",
				"value": showValuesBool,
			})
		}
	}

	// Draw style (bars)
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
			} else {
				properties = append(properties, map[string]interface{}{
					"id":    "custom.drawStyle",
					"value": "line",
				})
			}
		}
	}

	// Draw style (lines)
	if lines, ok := seriesMap["lines"]; ok {
		if linesBool, ok := lines.(bool); ok {
			if linesBool {
				properties = append(properties, map[string]interface{}{
					"id":    "custom.drawStyle",
					"value": "line",
				})
			} else {
				properties = append(properties, map[string]interface{}{
					"id":    "custom.lineWidth",
					"value": 0,
				})
			}
		}
	}

	// Line width
	if linewidth, ok := seriesMap["linewidth"]; ok {
		properties = append(properties, map[string]interface{}{
			"id":    "custom.lineWidth",
			"value": linewidth,
		})
	}

	// Point radius
	if pointradius, ok := seriesMap["pointradius"]; ok {
		if radius, ok := pointradius.(float64); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.pointSize",
				"value": 2 + radius*2,
			})
		}
	}

	// Dash length
	if dashLength, ok := seriesMap["dashLength"]; ok {
		if dashLengthVal, ok := dashLength.(float64); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.dashLength",
				"value": dashLengthVal,
			})
		}
	}

	// Space length
	if spaceLength, ok := seriesMap["spaceLength"]; ok {
		if spaceLengthVal, ok := spaceLength.(float64); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.spaceLength",
				"value": spaceLengthVal,
			})
		}
	}

	// Dashes
	if dashes, ok := seriesMap["dashes"]; ok {
		if dashesBool, ok := dashes.(bool); ok {
			properties = append(properties, map[string]interface{}{
				"id": "custom.lineStyle",
				"value": map[string]interface{}{
					"fill": func() string {
						if dashesBool {
							return "dash"
						}
						return "solid"
					}(),
				},
			})
		}
	}

	// Stack
	if stack, ok := seriesMap["stack"]; ok {
		if stackStr, ok := stack.(string); ok {
			properties = append(properties, map[string]interface{}{
				"id":    "custom.stacking",
				"value": stackStr,
			})
		}
	}

	// Transform
	if transform, ok := seriesMap["transform"]; ok {
		if transformStr, ok := transform.(string); ok {
			value := "constant"
			if transformStr == "negative-Y" {
				value = "negative-Y"
			}
			properties = append(properties, map[string]interface{}{
				"id":    "custom.transform",
				"value": value,
			})
		}
	}

	// Color
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

	return properties
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

	if oldThresholds, ok := panel["thresholds"].([]interface{}); ok && len(oldThresholds) > 0 {
		convertExistingThresholds(defaults, oldThresholds)
	} else {
		setDefaultThresholds(defaults)
	}

	// Clean up old thresholds
	delete(panel, "thresholds")
}

func convertExistingThresholds(defaults map[string]interface{}, oldThresholds []interface{}) {
	area, line := extractThresholdStyles(oldThresholds)

	// Sort thresholds by value
	sortedThresholds := sortThresholdsByValue(oldThresholds)

	// Convert to step-based thresholds
	steps := buildThresholdSteps(sortedThresholds)

	// Add base transparent step if needed
	steps = addBaseTransparentStep(steps)

	// Set threshold style mode
	setThresholdDisplayMode(defaults, area, line)

	// Set the new thresholds
	defaults["thresholds"] = map[string]interface{}{
		"mode":  "absolute",
		"steps": steps,
	}
}

func extractThresholdStyles(oldThresholds []interface{}) (bool, bool) {
	area, line := false, false
	for _, t := range oldThresholds {
		if threshold, ok := t.(map[string]interface{}); ok {
			if !area {
				if fill, ok := threshold["fill"].(bool); ok && fill {
					area = true
				}
			}
			if !line {
				if lineStyle, ok := threshold["line"].(bool); ok && lineStyle {
					line = true
				}
			}

			if area && line {
				break
			}
		}
	}
	return area, line
}

func sortThresholdsByValue(oldThresholds []interface{}) []map[string]interface{} {
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
	return sortedThresholds
}

func buildThresholdSteps(sortedThresholds []map[string]interface{}) []interface{} {
	steps := []interface{}{}

	for i, threshold := range sortedThresholds {
		op, _ := threshold["op"].(string)
		value, _ := threshold["value"].(float64)

		switch op {
		case "gt":
			steps = append(steps, map[string]interface{}{
				"value": value,
				"color": getThresholdColor(threshold),
			})
		case "lt":
			steps = appendLtThresholdSteps(steps, i, threshold, value, sortedThresholds)
		}
	}

	return steps
}

func appendLtThresholdSteps(steps []interface{}, index int, threshold map[string]interface{}, value float64, sortedThresholds []map[string]interface{}) []interface{} {
	// Add base transparent step for first lt threshold
	if index == 0 {
		steps = append(steps, map[string]interface{}{
			"value": interface{}(nil), // -Infinity equivalent
			"color": "transparent",
		})
	}

	// Check if next threshold is gt and there's a gap
	if index+1 < len(sortedThresholds) {
		nextThreshold := sortedThresholds[index+1]
		if nextOp, ok := nextThreshold["op"].(string); ok && nextOp == "gt" {
			if nextValue, ok := nextThreshold["value"].(float64); ok && nextValue > value {
				steps = append(steps, map[string]interface{}{
					"value": value,
					"color": "transparent",
				})
			}
		}
	}

	return steps
}

func addBaseTransparentStep(steps []interface{}) []interface{} {
	if len(steps) == 0 {
		return steps
	}

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

	return steps
}

func setThresholdDisplayMode(defaults map[string]interface{}, area, line bool) {
	displayMode := determineDisplayMode(area, line)

	if defaults["custom"] == nil {
		defaults["custom"] = map[string]interface{}{}
	}

	if custom, ok := defaults["custom"].(map[string]interface{}); ok {
		custom["thresholdsStyle"] = map[string]interface{}{
			"mode": displayMode,
		}
	}
}

func determineDisplayMode(area, line bool) string {
	if area && line {
		return "line+area"
	} else if area {
		return "area"
	} else if line {
		return "line"
	}
	return "line"
}

func setDefaultThresholds(defaults map[string]interface{}) {
	if defaults["custom"] == nil {
		defaults["custom"] = map[string]interface{}{}
	}

	if custom, ok := defaults["custom"].(map[string]interface{}); ok {
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
