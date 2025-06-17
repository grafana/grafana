package schemaversion

// V36 migrates dashboard datasource references from string names to UIDs.
// This migration converts datasource references in annotations, template variables, and panels
// from the old format (string name or UID) to the new format (object with uid, type, apiVersion).
func V36(dsInfo DataSourceInfoProvider) SchemaVersionMigrationFunc {
	datasources := dsInfo.GetDataSourceInfo()
	return func(dashboard map[string]interface{}) error {
		dashboard["schemaVersion"] = int(36)

		migrateAnnotations(dashboard, datasources)
		migrateTemplateVariables(dashboard, datasources)
		migratePanels(dashboard, datasources)

		return nil
	}
}

// migrateAnnotations updates datasource references in dashboard annotations
func migrateAnnotations(dashboard map[string]interface{}, datasources []DataSourceInfo) {
	annotations, ok := dashboard["annotations"].(map[string]interface{})
	if !ok {
		return
	}
	list, ok := annotations["list"].([]interface{})
	if !ok {
		return
	}
	for _, query := range list {
		queryMap, ok := query.(map[string]interface{})
		if !ok {
			continue
		}
		if ds, exists := queryMap["datasource"]; exists {
			queryMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
		}
	}
}

// migrateTemplateVariables updates datasource references in dashboard variables
func migrateTemplateVariables(dashboard map[string]interface{}, datasources []DataSourceInfo) {
	templating, ok := dashboard["templating"].(map[string]interface{})
	if !ok {
		return
	}
	list, ok := templating["list"].([]interface{})
	if !ok {
		return
	}
	for _, variable := range list {
		varMap, ok := variable.(map[string]interface{})
		if !ok {
			continue
		}
		if varType, ok := varMap["type"].(string); ok && varType == "query" {
			if ds, exists := varMap["datasource"]; exists {
				varMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
			}
		}
	}
}

// migratePanels updates datasource references in dashboard panels
func migratePanels(dashboard map[string]interface{}, datasources []DataSourceInfo) {
	if panels, ok := dashboard["panels"].([]interface{}); ok {
		for _, panel := range panels {
			if panelMap, ok := panel.(map[string]interface{}); ok {
				migratePanelDatasources(panelMap, datasources)
			}
		}
	}
}

// migratePanelDatasources updates datasource references in a single panel and its targets
func migratePanelDatasources(panelMap map[string]interface{}, datasources []DataSourceInfo) {
	if targets, hasTargets := panelMap["targets"].([]interface{}); hasTargets && len(targets) > 0 {
		panelDataSourceWasDefault := false

		// Handle panel datasource
		if ds, exists := panelMap["datasource"]; exists {
			if ds == nil {
				defaultDS := GetDefaultDSInstanceSettings(datasources)
				panelMap["datasource"] = GetDataSourceRef(defaultDS)
				panelDataSourceWasDefault = true
			} else {
				panelMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources)
			}
		}

		// Handle target datasources
		for _, target := range targets {
			if targetMap, ok := target.(map[string]interface{}); ok {
				ds, exists := targetMap["datasource"]

				// Check if target datasource is null or has no uid
				isNullOrNoUID := !exists || ds == nil
				if !isNullOrNoUID {
					if dsMap, ok := ds.(map[string]interface{}); ok {
						if uid, hasUID := dsMap["uid"]; !hasUID || uid == nil {
							isNullOrNoUID = true
						}
					}
				}

				if isNullOrNoUID {
					// If panel doesn't have mixed datasource, use panel's datasource
					if panelDS, ok := panelMap["datasource"].(map[string]interface{}); ok {
						if uid, hasUID := panelDS["uid"].(string); hasUID && uid != "-- Mixed --" {
							targetMap["datasource"] = panelDS
						}
					}
				} else {
					// Migrate existing target datasource
					targetDS := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
					targetMap["datasource"] = targetDS
				}

				// Update panel datasource if it was default and target is not an expression
				if panelDataSourceWasDefault {
					if targetDS, ok := targetMap["datasource"].(map[string]interface{}); ok {
						if uid, ok := targetDS["uid"].(string); ok && uid != "__expr__" {
							panelMap["datasource"] = targetDS
						}
					}
				}
			}
		}
	}
}
