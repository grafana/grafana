package schemaversion

// V22 migrates table panel styles to set align property to 'auto'.
// This migration ensures that all table panel styles have their align property
// set to 'auto' for consistent alignment behavior.
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "type": "table",
//	    "styles": [
//	      { "type": "number", "pattern": "Time", "align": "left" },
//	      { "type": "string", "pattern": "Value", "align": "right" }
//	    ]
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "type": "table",
//	    "styles": [
//	      { "type": "number", "pattern": "Time", "align": "auto" },
//	      { "type": "string", "pattern": "Value", "align": "auto" }
//	    ]
//	  }
//	]
func V22(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 22

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process table panels
		panelType, ok := panel["type"].(string)
		if !ok || panelType != "table" {
			continue
		}

		styles, ok := panel["styles"].([]interface{})
		if !ok {
			continue
		}

		// Update each style to set align to 'auto'
		for _, s := range styles {
			style, ok := s.(map[string]interface{})
			if !ok {
				continue
			}
			style["align"] = "auto"
		}
	}

	return nil
}
