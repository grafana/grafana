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
	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		migratePanelDatasourcesV33(panelMap, datasources)

		// Handle nested panels in collapsed rows
		nestedPanels, hasNested := panelMap["panels"].([]interface{})
		if !hasNested {
			continue
		}

		for _, nestedPanel := range nestedPanels {
			np, ok := nestedPanel.(map[string]interface{})
			if !ok {
				continue
			}
			migratePanelDatasourcesV33(np, datasources)
		}
	}
}

// migratePanelDatasourcesV33 updates datasource references in a single panel and its targets for V33 migration
func migratePanelDatasourcesV33(panelMap map[string]interface{}, datasources []DataSourceInfo) {
	// Handle panel datasource
	if ds, exists := panelMap["datasource"]; exists {
		if result := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources); result != nil {
			panelMap["datasource"] = result
		} else {
			panelMap["datasource"] = nil
		}
	}

	// Handle target datasources
	targets, hasTargets := panelMap["targets"].([]interface{})
	if !hasTargets {
		return
	}

	for _, target := range targets {
		targetMap, ok := target.(map[string]interface{})
		if !ok {
			continue
		}

		ds, exists := targetMap["datasource"]
		if !exists {
			continue
		}

		// Skip migration for lowercase "default" - should remain as string
		if dsStr, ok := ds.(string); ok && dsStr == "default" {
			continue
		}

		if targetRef := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources); targetRef != nil {
			targetMap["datasource"] = targetRef
		} else {
			targetMap["datasource"] = nil
		}
	}
}
