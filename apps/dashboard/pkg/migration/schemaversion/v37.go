package schemaversion

// V37 normalizes legend configuration to use `showLegend` property consistently.
//
// This migration addresses inconsistencies in how legend visibility was handled.
// There were two ways to hide the legend:
// 1. Using displayMode: "hidden"
// 2. Using showLegend: false
//
// The migration normalizes both approaches to use showLegend consistently:
// - If displayMode is "hidden" OR showLegend is false, set displayMode to "list" and showLegend to false
// - For all other existing legend objects, ensure showLegend is true
//
// Note: This migration only processes legend configurations that already exist as objects.
// Boolean legend values are not processed by this migration.
//
// Example transformations:
//
// Before migration (hidden displayMode):
//
//	options: {
//	  legend: {
//	    displayMode: "hidden",
//	    placement: "bottom"
//	  }
//	}
//
// After migration:
//
//	options: {
//	  legend: {
//	    displayMode: "list",
//	    showLegend: false,
//	    placement: "bottom"
//	  }
//	}
//
// Before migration (showLegend false):
//
//	options: {
//	  legend: {
//	    displayMode: "table",
//	    showLegend: false
//	  }
//	}
//
// After migration:
//
//	options: {
//	  legend: {
//	    displayMode: "list",
//	    showLegend: false
//	  }
//	}
//
// Before migration (visible legend):
//
//	options: {
//	  legend: {
//	    displayMode: "table",
//	    placement: "bottom"
//	  }
//	}
//
// After migration:
//
//	options: {
//	  legend: {
//	    displayMode: "table",
//	    placement: "bottom",
//	    showLegend: true
//	  }
//	}
func V37(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(37)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	// Process all panels, including nested ones
	processPanelsV37(panels)

	return nil
}

// processPanelsV37 recursively processes panels, including nested panels within rows
func processPanelsV37(panels []interface{}) {
	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Process nested panels if this is a row panel
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				processPanelsV37(nestedPanels)
			}
			continue
		}

		options, ok := p["options"].(map[string]interface{})
		if !ok {
			continue
		}

		// Only process legend if it exists and is an object (not boolean)
		legendValue := options["legend"]
		legend, ok := legendValue.(map[string]interface{})
		if !ok || legend == nil {
			continue
		}

		displayMode, _ := legend["displayMode"].(string)
		showLegend, hasShowLegend := legend["showLegend"].(bool)

		// If displayMode is "hidden" OR showLegend is false, normalize to hidden legend
		if displayMode == "hidden" || (hasShowLegend && !showLegend) {
			legend["displayMode"] = "list"
			legend["showLegend"] = false
		} else {
			// For all other cases, ensure showLegend is true
			legend["showLegend"] = true
		}
	}
}
