package schemaversion

// V37 normalizes legend configuration across all panel types to use a consistent object format.
//
// This migration addresses inconsistencies in legend configuration that accumulated over time as
// different panel types implemented their own legend handling approaches. The problem arose from:
// - Some panels accepting boolean values for simple show/hide functionality
// - Others using object configuration with various property combinations
// - Legacy "hidden" displayMode values that contradicted the showLegend property
// - Inconsistent property precedence when both displayMode and showLegend were present
//
// The migration works by:
// 1. Scanning all panels in the dashboard for legend configuration in their options
// 2. Converting boolean legend values to the standardized object format
// 3. Normalizing deprecated "hidden" displayMode to the consistent showLegend: false approach
// 4. Ensuring all visible legends explicitly set showLegend: true for clarity
// 5. Standardizing on "list" as the primary displayMode for visible legends
//
// This normalization provides several critical benefits:
// - Unified legend API across all panel types enables consistent UI controls
// - Eliminates confusion between displayMode and showLegend property conflicts
// - Prepares the schema for future legend enhancements (positioning, styling, etc.)
// - Removes deprecated displayMode values that cause rendering inconsistencies
// - Enables reliable legend state detection for dashboard automation tools
//
// The migration is conservative, preserving all existing visual behavior while establishing
// a clean foundation for future legend functionality improvements.
//
// Example transformations:
//
// Before migration (boolean format):
//
//	options: {
//	  legend: true
//	}
//
// After migration (standardized object):
//
//	options: {
//	  legend: {
//	    displayMode: "list",
//	    showLegend: true
//	  }
//	}
//
// Before migration (deprecated hidden mode):
//
//	options: {
//	  legend: {
//	    displayMode: "hidden",
//	    showLegend: true
//	  }
//	}
//
// After migration (consistent hidden format):
//
//	options: {
//	  legend: {
//	    displayMode: "list",
//	    showLegend: false
//	  }
//	}
//
// Before migration (conflicting properties):
//
//	options: {
//	  legend: {
//	    displayMode: "table",
//	    showLegend: false
//	  }
//	}
//
// After migration (resolved conflict):
//
//	options: {
//	  legend: {
//	    displayMode: "list",
//	    showLegend: false
//	  }
//	}
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
