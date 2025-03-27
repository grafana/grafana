package schemaversion

// V38 updates the configuration of the table panel to use the new cellOptions format
// and updates the overrides to use the new cellOptions format
func V38(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(38)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process table panels
		if p["type"] != "table" {
			continue
		}

		fieldConfig, ok := p["fieldConfig"].(map[string]interface{})
		if !ok {
			continue
		}

		defaults, ok := fieldConfig["defaults"].(map[string]interface{})
		if !ok {
			continue
		}

		custom, ok := defaults["custom"].(map[string]interface{})
		if !ok {
			continue
		}

		// Migrate displayMode to cellOptions
		if displayMode, exists := custom["displayMode"]; exists {
			if displayModeStr, ok := displayMode.(string); ok {
				custom["cellOptions"] = migrateTableDisplayModeToCellOptions(displayModeStr)
			}
			// Delete the legacy field
			delete(custom, "displayMode")
		}

		// Update any overrides referencing the cell display mode
		migrateOverrides(fieldConfig)
	}

	return nil
}

// migrateOverrides updates the overrides configuration to use the new cellOptions format
func migrateOverrides(fieldConfig map[string]interface{}) {
	overrides, ok := fieldConfig["overrides"].([]interface{})
	if !ok {
		return
	}

	for _, override := range overrides {
		o, ok := override.(map[string]interface{})
		if !ok {
			continue
		}

		properties, ok := o["properties"].([]interface{})
		if !ok {
			continue
		}

		for _, property := range properties {
			prop, ok := property.(map[string]interface{})
			if !ok {
				continue
			}

			// Update the id to cellOptions
			if prop["id"] == "custom.displayMode" {
				prop["id"] = "custom.cellOptions"
				if value, ok := prop["value"]; ok {
					if valueStr, ok := value.(string); ok {
						prop["value"] = migrateTableDisplayModeToCellOptions(valueStr)
					}
				}
			}
		}
	}
}

// migrateTableDisplayModeToCellOptions converts the old displayMode string to the new cellOptions format
func migrateTableDisplayModeToCellOptions(displayMode string) map[string]interface{} {
	switch displayMode {
	case "basic", "gradient-gauge", "lcd-gauge":
		gaugeMode := "basic"
		if displayMode == "gradient-gauge" {
			gaugeMode = "gradient"
		} else if displayMode == "lcd-gauge" {
			gaugeMode = "lcd"
		}
		return map[string]interface{}{
			"type": "gauge",
			"mode": gaugeMode,
		}

	case "color-background", "color-background-solid":
		mode := "basic"
		if displayMode == "color-background" {
			mode = "gradient"
		}
		return map[string]interface{}{
			"type": "color-background",
			"mode": mode,
		}

	default:
		return map[string]interface{}{
			"type": displayMode,
		}
	}
}
