package schemaversion

// V37 normalizes legend configuration in panels to use a consistent format:
// - Converts boolean legend values to object format
// - Standardizes hidden legends to use showLegend: false with displayMode: list
// - Ensures visible legends have showLegend: true
func V37(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(37)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		options, ok := p["options"].(map[string]interface{})
		if !ok {
			continue
		}

		// Skip if no legend config exists
		legendValue := options["legend"]
		if legendValue == nil {
			continue
		}

		// Convert boolean legend to object format
		if legendBool, ok := legendValue.(bool); ok {
			options["legend"] = map[string]interface{}{
				"displayMode": "list",
				"showLegend":  legendBool,
			}
			continue
		}

		// Handle object format legend
		legend, ok := legendValue.(map[string]interface{})
		if !ok {
			continue
		}

		displayMode, hasDisplayMode := legend["displayMode"].(string)
		showLegend, hasShowLegend := legend["showLegend"].(bool)

		// Normalize hidden legends
		if (hasDisplayMode && displayMode == "hidden") || (hasShowLegend && !showLegend) {
			legend["displayMode"] = "list"
			legend["showLegend"] = false
			continue
		}

		// Ensure visible legends have showLegend true
		legend["showLegend"] = true
	}

	return nil
}
