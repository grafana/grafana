package schemaversion

import "context"

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
func V22(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 22

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		migrateTableStyles(p)

		// Handle nested panels in collapsed rows
		if !IsArray(p["panels"]) {
			continue
		}
		for _, nestedPanel := range p["panels"].([]interface{}) {
			np, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			migrateTableStyles(np)
		}
	}

	return nil
}

// migrateTableStyles sets the align property of every style in a table panel to 'auto'.
func migrateTableStyles(panel map[string]interface{}) {
	panelType, ok := panel["type"].(string)
	if !ok || panelType != "table" {
		return
	}

	styles, ok := panel["styles"].([]interface{})
	if !ok {
		return
	}

	for _, s := range styles {
		style, ok := s.(map[string]interface{})
		if !ok {
			continue
		}
		style["align"] = "auto"
	}
}
