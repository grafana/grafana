package schemaversion

// V42 ensures that when a field is hidden from visualization, it is also hidden from tooltips.
//
// This migration addresses the inconsistency where fields could be hidden from visualizations
// (hideFrom.viz = true) but would still appear in tooltips. To prevent user confusion and ensure
// consistent behavior, this migration automatically sets hideFrom.tooltip = true for any field
// configuration override that has hideFrom.viz = true.
//
// The migration specifically targets field configuration overrides, including the special
// __systemRef override, and updates the hideFrom object to include tooltip: true whenever
// viz: true is found.
//
// Example transformation:
//
// Before migration:
//
//	fieldConfig: {
//	  overrides: [{
//	    properties: [{
//	      id: "custom.hideFrom",
//	      value: { viz: true }
//	    }]
//	  }]
//	}
//
// After migration:
//
//	fieldConfig: {
//	  overrides: [{
//	    properties: [{
//	      id: "custom.hideFrom",
//	      value: { viz: true, tooltip: true }
//	    }]
//	  }]
//	}
func V42(dash map[string]interface{}) error {
	dash["schemaVersion"] = int(42)

	// Get panels from dashboard
	panels, ok := dash["panels"].([]interface{})
	if !ok {
		return nil
	}

	// Process each panel
	for _, panelInterface := range panels {
		panel, ok := panelInterface.(map[string]interface{})
		if !ok {
			continue
		}

		migrateHideFromForPanel(panel)
	}

	return nil
}

// migrateHideFromForPanel processes a single panel and its nested panels
func migrateHideFromForPanel(panel map[string]interface{}) {
	// Process the panel's field config
	if fieldConfig, ok := panel["fieldConfig"].(map[string]interface{}); ok {
		if overrides, ok := fieldConfig["overrides"].([]interface{}); ok {
			for _, overrideInterface := range overrides {
				override, ok := overrideInterface.(map[string]interface{})
				if !ok {
					continue
				}

				if properties, ok := override["properties"].([]interface{}); ok {
					for _, propertyInterface := range properties {
						property, ok := propertyInterface.(map[string]interface{})
						if !ok {
							continue
						}

						// Check if this is a custom.hideFrom property
						if id, ok := property["id"].(string); ok && id == "custom.hideFrom" {
							if value, ok := property["value"].(map[string]interface{}); ok {
								// If viz is true, also set tooltip to true
								if GetBoolValue(value, "viz") {
									value["tooltip"] = true
								}
							}
						}
					}
				}
			}
		}
	}

	// Process nested panels (for rows)
	if nestedPanels, ok := panel["panels"].([]interface{}); ok {
		for _, nestedPanelInterface := range nestedPanels {
			if nestedPanel, ok := nestedPanelInterface.(map[string]interface{}); ok {
				migrateHideFromForPanel(nestedPanel)
			}
		}
	}
}
