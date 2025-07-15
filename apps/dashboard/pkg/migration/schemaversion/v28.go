package schemaversion

// V28 migrates singlestat panels to stat/gauge panels and removes deprecated variable properties.
//
// The migration performs two main tasks:
// 1. Migrates singlestat panels to either stat or gauge panels based on their configuration
// 2. Removes deprecated variable properties (tags, tagsQuery, tagValuesQuery, useTags)
//
// Example before migration:
//
//	"panels": [
//	  {
//	    "type": "singlestat",
//	    "gauge": { "show": true },
//	    "targets": [{ "refId": "A" }]
//	  }
//	],
//	"templating": {
//	  "list": [
//	    { "name": "var1", "tags": ["tag1"], "tagsQuery": "query", "tagValuesQuery": "values", "useTags": true }
//	  ]
//	}
//
// Example after migration:
//
//	"panels": [
//	  {
//	    "type": "gauge",
//	    "targets": [{ "refId": "A" }]
//	  }
//	],
//	"templating": {
//	  "list": [
//	    { "name": "var1" }
//	  ]
//	}
func V28(panelProvider PanelPluginInfoProvider) SchemaVersionMigrationFunc {
	panelPlugins := panelProvider.GetPanels()

	return func(dashboard map[string]interface{}) error {
		dashboard["schemaVersion"] = 28

		// Migrate singlestat panels
		if panels, ok := dashboard["panels"].([]interface{}); ok {
			for _, p := range panels {
				if panel, ok := p.(map[string]interface{}); ok {
					if panel["type"] == "singlestat" {
						migrateSinglestatPanel(panel, panelPlugins)
					}
				}
			}
		}

		// Remove deprecated variable properties
		if templating, ok := dashboard["templating"].(map[string]interface{}); ok {
			if list, ok := templating["list"].([]interface{}); ok {
				for _, v := range list {
					if variable, ok := v.(map[string]interface{}); ok {
						removeDeprecatedVariableProperties(variable)
					}
				}
			}
		}

		return nil
	}
}

// migrateSinglestatPanel migrates a singlestat panel to either stat or gauge panel
func migrateSinglestatPanel(panel map[string]interface{}, panels []PanelPluginInfo) {
	// Check if grafana-singlestat-panel plugin exists
	for _, info := range panels {
		if info.ID == "grafana-singlestat-panel" {
			panel["type"] = "grafana-singlestat-panel"
			return
		}
	}

	// Check if gauge is enabled
	if gauge, ok := panel["gauge"].(map[string]interface{}); ok {
		if show, ok := gauge["show"].(bool); ok && show {
			panel["type"] = "gauge"
			return
		}
	}

	// Default to stat panel
	panel["type"] = "stat"
}

// removeDeprecatedVariableProperties removes deprecated properties from variables
func removeDeprecatedVariableProperties(variable map[string]interface{}) {
	// Remove deprecated properties
	delete(variable, "tags")
	delete(variable, "tagsQuery")
	delete(variable, "tagValuesQuery")
	delete(variable, "useTags")
}
