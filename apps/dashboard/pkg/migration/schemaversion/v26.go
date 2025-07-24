package schemaversion

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

			// Fix: Delete the angular field from within options, not the string "options.angular"
			if options, ok := panelMap["options"].(map[string]interface{}); ok {
				delete(options, "angular")
			}
		}
	}

	return nil
}
