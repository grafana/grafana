package schemaversion

// V33 migrates panel datasource references from string names to UIDs.
// This migration converts datasource references in panels and their targets
// from the old format (string name or UID) to the new format (object with uid, type, apiVersion).
func V33(dsInfo DataSourceInfoProvider) SchemaVersionMigrationFunc {
	datasources := dsInfo.GetDataSourceInfo()
	return func(dashboard map[string]interface{}) error {
		dashboard["schemaVersion"] = int(33)

		migratePanelsV33(dashboard, datasources)

		return nil
	}
}

// migratePanelsV33 updates datasource references in dashboard panels for V33 migration
func migratePanelsV33(dashboard map[string]interface{}, datasources []DataSourceInfo) {
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		for _, panel := range panels {
			if panelMap, ok := panel.(map[string]interface{}); ok {
				migratePanelDatasourcesV33(panelMap, datasources)

				// Handle nested panels in collapsed rows
				if nestedPanels, hasNested := panelMap["panels"].([]interface{}); hasNested {
					for _, nestedPanel := range nestedPanels {
						if np, ok := nestedPanel.(map[string]interface{}); ok {
							migratePanelDatasourcesV33(np, datasources)
						}
					}
				}
			}
		}
	}
}

// migratePanelDatasourcesV33 updates datasource references in a single panel and its targets for V33 migration
func migratePanelDatasourcesV33(panelMap map[string]interface{}, datasources []DataSourceInfo) {
	// Handle panel datasource
	if ds, exists := panelMap["datasource"]; exists {
		panelMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources)
	}

	// Handle target datasources
	if targets, hasTargets := panelMap["targets"].([]interface{}); hasTargets {
		for _, target := range targets {
			if targetMap, ok := target.(map[string]interface{}); ok {
				if ds, exists := targetMap["datasource"]; exists {
					targetRef := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources)
					if targetRef != nil {
						targetMap["datasource"] = targetRef
					}
				}
			}
		}
	}
}
