package schemaversion

// V29 migrates query variables to ensure their refresh property is set to 1 (on dashboard load)
// if it is not 1 or 2, and clears their options array if present.
//
// Example before migration:
//
//	"templating": {
//	  "list": [
//	    { "type": "query", "refresh": 0, "options": [{ "text": "A", "value": "A" }] },
//	    { "type": "query", "refresh": 2, "options": [{ "text": "B", "value": "B" }] },
//	    { "type": "query", "options": [{ "text": "C", "value": "C" }] }
//	  ]
//	}
//
// Example after migration:
//
//	"templating": {
//	  "list": [
//	    { "type": "query", "refresh": 1, "options": [] },
//	    { "type": "query", "refresh": 2, "options": [] },
//	    { "type": "query", "refresh": 1, "options": [] }
//	  ]
//	}
func V29(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 29

	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return nil
	}
	list, ok := templating["list"].([]interface{})
	if !ok {
		return nil
	}
	for _, v := range list {
		variable, ok := v.(map[string]interface{})
		if !ok {
			continue
		}
		if variable["type"] != "query" {
			continue
		}
		// Set refresh to 1 if not 1 or 2
		refresh, hasRefresh := variable["refresh"]
		refreshInt := 0
		if r, ok := refresh.(int); ok {
			refreshInt = r
		}
		if !hasRefresh || (refreshInt != 1 && refreshInt != 2) {
			variable["refresh"] = 1
		}
		// Clear options if present
		if _, hasOptions := variable["options"]; hasOptions {
			variable["options"] = []interface{}{}
		}
	}
	return nil
}
