package schemaversion

// V27 migrates repeated panels and constant variables.
//
// The migration performs two main tasks:
// 1. Removes repeated panel leftovers by filtering out panels with repeatPanelId or repeatByRow
// 2. Migrates constant variables to textbox variables with proper current/options structure
//
// The migration includes comprehensive logic from the frontend:
// - Panel filtering to remove repeated panels
// - Constant variable migration with proper current/options structure
// - Support for both constant and textbox variable types
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "graph",
//	    "repeatPanelId": "panel1"
//	  },
//	  {
//	    "id": 2,
//	    "type": "row",
//	    "panels": [
//	      {
//	        "id": 3,
//	        "type": "graph",
//	        "repeatPanelId": "panel2"
//	      }
//	    ]
//	  }
//	],
//	"templating": {
//	  "list": [
//	    {
//	      "name": "constant_var",
//	      "type": "constant",
//	      "query": "default_value",
//	      "hide": 0
//	    }
//	  ]
//	}
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "id": 2,
//	    "type": "row",
//	    "panels": []
//	  }
//	],
//	"templating": {
//	  "list": [
//	    {
//	      "name": "constant_var",
//	      "type": "textbox",
//	      "query": "default_value",
//	      "current": {
//	        "selected": true,
//	        "text": "default_value",
//	        "value": "default_value"
//	      },
//	      "options": [
//	        {
//	          "selected": true,
//	          "text": "default_value",
//	          "value": "default_value"
//	        }
//	      ],
//	      "hide": 0
//	    }
//	  ]
//	}
func V27(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 27

	// Remove repeated panels
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		dashboard["panels"] = removeRepeatedPanels(panels)
	}

	// Migrate constant variables
	if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
		if list, ok := templating["list"].([]interface{}); ok {
			for _, v := range list {
				if variable, ok := v.(map[string]interface{}); ok {
					migrateConstantVariable(variable)
				}
			}
		}
	}

	return nil
}

// removeRepeatedPanels filters out panels with repeatPanelId or repeatByRow properties
// and cleans up repeated panels in collapsed rows
func removeRepeatedPanels(panels []interface{}) []interface{} {
	newPanels := []interface{}{}

	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		// Skip panels with repeatPanelId or repeatByRow
		if _, hasRepeatPanelId := p["repeatPanelId"]; hasRepeatPanelId {
			continue
		}
		if _, hasRepeatByRow := p["repeatByRow"]; hasRepeatByRow {
			continue
		}

		// Filter out repeats in collapsed rows
		if p["type"] == "row" {
			if nestedPanels, ok := p["panels"].([]interface{}); ok {
				filteredNestedPanels := make([]interface{}, 0)
				for _, nestedPanel := range nestedPanels {
					if np, ok := nestedPanel.(map[string]interface{}); ok {
						if _, hasRepeatPanelId := np["repeatPanelId"]; !hasRepeatPanelId {
							filteredNestedPanels = append(filteredNestedPanels, nestedPanel)
						}
					}
				}
				p["panels"] = filteredNestedPanels
			}
		}

		newPanels = append(newPanels, panel)
	}

	return newPanels
}

// migrateConstantVariable converts constant variables to textbox variables with proper current/options structure
func migrateConstantVariable(variable map[string]interface{}) {
	if variableType, ok := variable["type"].(string); !ok || variableType != "constant" {
		return
	}

	query := ""
	if queryVal, ok := variable["query"].(string); ok {
		query = queryVal
	}
	variable["query"] = query

	current := map[string]interface{}{
		"selected": true,
		"text":     query,
		"value":    query,
	}

	options := []interface{}{current}

	variable["current"] = current
	variable["options"] = options

	// Convert to textbox if hide is 0 (dontHide) or 1 (hideLabel)
	if hide, ok := variable["hide"].(float64); ok {
		if hide == 0 || hide == 1 {
			variable["type"] = "textbox"
		}
	}
}
