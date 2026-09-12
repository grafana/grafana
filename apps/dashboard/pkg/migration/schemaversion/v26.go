package schemaversion

import "context"

// V26 migration performs two main tasks:
// 1. Converts all text2 panels to text panels by changing the type field
// 2. Removes the angular field from panel options if it exists
//
// The migration includes comprehensive logic from the frontend:
// - Panel type conversion from "text2" to "text"
// - Angular field removal from panel options
// - Support for nested panels in rows
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "text2",
//	    "title": "Text Panel",
//	    "options": {
//	      "content": "Some content",
//	      "angular": true,
//	      "mode": "markdown"
//	    }
//	  },
//	  {
//	    "id": 2,
//	    "type": "row",
//	    "title": "Row Panel",
//	    "panels": [
//	      {
//	        "id": 3,
//	        "type": "text2",
//	        "title": "Nested Text Panel",
//	        "options": {
//	          "content": "Nested content",
//	          "angular": false,
//	          "mode": "html"
//	        }
//	      }
//	    ]
//	  },
//	  {
//	    "id": 4,
//	    "type": "graph",
//	    "title": "Graph Panel"
//	  }
//	]
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "id": 1,
//	    "type": "text",
//	    "title": "Text Panel",
//	    "options": {
//	      "content": "Some content",
//	      "mode": "markdown"
//	    }
//	  },
//	  {
//	    "id": 2,
//	    "type": "row",
//	    "title": "Row Panel",
//	    "panels": [
//	      {
//	        "id": 3,
//	        "type": "text",
//	        "title": "Nested Text Panel",
//	        "options": {
//	          "content": "Nested content",
//	          "mode": "html"
//	        }
//	      }
//	    ]
//	  },
//	  {
//	    "id": 4,
//	    "type": "graph",
//	    "title": "Graph Panel"
//	  }
//	]
func V26(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 26

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}
		migrateText2Panel(p)

		// Handle nested panels in collapsed rows
		if !IsArray(p["panels"]) {
			continue
		}
		for _, nestedPanel := range p["panels"].([]interface{}) {
			np, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			migrateText2Panel(np)
		}
	}

	return nil
}

// migrateText2Panel converts a text2 panel to a text panel and removes the
// angular field from its options.
func migrateText2Panel(panelMap map[string]interface{}) {
	if panelMap["type"] != "text2" {
		return
	}
	panelMap["type"] = "text"
	if options, ok := panelMap["options"].(map[string]interface{}); ok {
		delete(options, "angular")
	}
}
