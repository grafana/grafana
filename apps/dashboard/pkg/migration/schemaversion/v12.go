package schemaversion

// V12 migrates template variables to update their refresh and hide properties.
// This migration ensures that:
// 1. Variables with refresh=true get refresh=1, and variables with refresh=false get refresh=0
// 2. Variables with hideVariable=true get hide=2 (hide variable)
// 3. Variables with hideLabel=true get hide=1 (hide label)
//
// Example before migration:
//
//	"templating": {
//	  "list": [
//	    { "type": "query", "name": "var1", "refresh": true, "hideVariable": true },
//	    { "type": "query", "name": "var2", "refresh": false, "hideLabel": true }
//	  ]
//	}
//
// Example after migration:
//
//	"templating": {
//	  "list": [
//	    { "type": "query", "name": "var1", "refresh": 1, "hide": 2 },
//	    { "type": "query", "name": "var2", "refresh": 0, "hide": 1 }
//	  ]
//	}
func V12(dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 12

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

		// Update refresh property
		if _, hasRefresh := variable["refresh"]; hasRefresh {
			if GetBoolValue(variable, "refresh") {
				variable["refresh"] = 1
			} else {
				variable["refresh"] = 0
			}
		}

		// Update hide property based on hideVariable and hideLabel
		// hideVariable takes priority over hideLabel
		if GetBoolValue(variable, "hideVariable") {
			variable["hide"] = 2
			delete(variable, "hideVariable")
			delete(variable, "hideLabel") // Remove both properties when hideVariable is true
		} else if GetBoolValue(variable, "hideLabel") {
			variable["hide"] = 1
			delete(variable, "hideLabel")
		}
	}

	return nil
}
