package schemaversion

// GetPanelPluginToMigrateTo determines which panel plugin a legacy panel should be migrated to.
// This function replicates the frontend logic from getPanelPluginToMigrateTo.ts to ensure
// backend and frontend migrations produce identical results.
//
// The migration logic handles special cases for graph panels based on their configuration:
// - Graph panels with xaxis.mode = "series" and legend.values → bargauge
// - Graph panels with xaxis.mode = "series" (no legend.values) → barchart
// - Graph panels with xaxis.mode = "histogram" → histogram
// - Graph panels (default case) → timeseries
// - Other panel types use the autoMigrateAngular mapping
//
// Returns the target panel type or empty string if no migration is needed.
func GetPanelPluginToMigrateTo(panel map[string]interface{}) string {
	panelType, ok := panel["type"].(string)
	if !ok {
		return ""
	}

	// Graph panels need special logic as they can be migrated to multiple panels
	if panelType == "graph" {
		return getMigrationTargetForGraphPanel(panel)
	}

	// For other panel types, use the standard auto-migration mapping
	autoMigrations := getAutoMigrateAngularMapping()
	if newType, shouldMigrate := autoMigrations[panelType]; shouldMigrate {
		return newType
	}

	return ""
}

// getMigrationTargetForGraphPanel determines the migration target for graph panels
// based on their xaxis and legend configuration
func getMigrationTargetForGraphPanel(panel map[string]interface{}) string {
	// Check xaxis configuration
	if xaxis, ok := panel["xaxis"].(map[string]interface{}); ok {
		if mode, ok := xaxis["mode"].(string); ok {
			switch mode {
			case "series":
				// If xaxis.mode is "series", check for legend.values
				if legend, ok := panel["legend"].(map[string]interface{}); ok {
					if values, exists := legend["values"]; exists && values != nil {
						return "bargauge"
					}
				}
				return "barchart"
			case "histogram":
				return "histogram"
			}
		}
	}

	// Default case for graph panels
	return "timeseries"
}

// getAutoMigrateAngularMapping returns the standard Angular to React panel mappings
// This replicates the autoMigrateAngular object from the frontend PanelModel.ts
func getAutoMigrateAngularMapping() map[string]string {
	return map[string]string{
		"graph":                    "timeseries", // Note: graph has special logic above
		"table-old":                "table",
		"singlestat":               "stat",
		"grafana-singlestat-panel": "stat",
		"grafana-piechart-panel":   "piechart",
		"grafana-worldmap-panel":   "geomap",
		"natel-discrete-panel":     "state-timeline",
	}
}

// ApplyPanelTypeMigration applies the panel type migration to a panel and sets autoMigrateFrom
// if a migration is performed. This is the main function used by the migration.
func ApplyPanelTypeMigration(panel map[string]interface{}) {
	originalType, ok := panel["type"].(string)
	if !ok {
		return
	}

	newType := GetPanelPluginToMigrateTo(panel)
	if newType != "" && newType != originalType {
		// Set autoMigrateFrom to track the original panel type (matching frontend behavior)
		panel["autoMigrateFrom"] = originalType
		panel["type"] = newType
	}
}
