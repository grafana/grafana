package schemaversion

import "context"

// V38 migrates table panel configuration from displayMode to the structured cellOptions format.
//
// This migration addresses limitations in the original table panel cell display configuration where
// the flat displayMode string property could not accommodate the growing complexity of cell rendering
// options. The original design forced all display settings into a single string value, making it
// difficult to add new customization parameters or provide mode-specific configuration options.
//
// The migration works by:
// 1. Locating table panels in the dashboard (including nested panels within rows)
// 2. Examining field configuration defaults and any field overrides for displayMode properties
// 3. Converting string displayMode values to structured cellOptions objects with type and mode
// 4. Updating both field defaults and field override references to use the new property path
// 5. Preserving all existing visual behavior while enabling future cell customization features
//
// This restructuring provides several key benefits:
// - Enables mode-specific configuration options (e.g., gauge thresholds, color schemes)
// - Supports future cell rendering types without breaking existing configurations
// - Provides clearer separation between cell type and rendering mode
// - Maintains backward compatibility while preparing for enhanced table functionality
//
// The migration handles special cases for legacy gauge modes and color background variants,
// ensuring all existing display behaviors are preserved exactly.
//
// Example transformations:
//
// Before migration (field defaults):
//
//	fieldConfig: {
//	  defaults: {
//	    custom: {
//	      displayMode: "gradient-gauge"
//	    }
//	  }
//	}
//
// After migration (field defaults):
//
//	fieldConfig: {
//	  defaults: {
//	    custom: {
//	      cellOptions: {
//	        type: "gauge",
//	        mode: "gradient"
//	      }
//	    }
//	  }
//	}
//
// Before migration (field override):
//
//	overrides: [{
//	  matcher: { id: "byName", options: "CPU" },
//	  properties: [{
//	    id: "custom.displayMode",
//	    value: "color-background-solid"
//	  }]
//	}]
//
// After migration (field override):
//
//	overrides: [{
//	  matcher: { id: "byName", options: "CPU" },
//	  properties: [{
//	    id: "custom.cellOptions",
//	    value: {
//	      type: "color-background",
//	      mode: "basic"
//	    }
//	  }]
//	}]
func V38(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(38)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	// Process all panels, including nested ones
	processPanelsV38(panels)

	return nil
}

// processPanelsV38 recursively processes panels, including nested panels within rows
func processPanelsV38(panels []interface{}) {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				processPanelsV38(nestedPanels)
			}
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
		switch displayMode {
		case "gradient-gauge":
			gaugeMode = "gradient"
		case "lcd-gauge":
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
