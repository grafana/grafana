package schemaversion

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
func V26(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 26

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}
		if panelMap["type"] == "text2" {
			panelMap["type"] = "text"

			if options, ok := panelMap["options"].(map[string]interface{}); ok {
				delete(options, "angular")
			}
		}
	}

	return nil
}
