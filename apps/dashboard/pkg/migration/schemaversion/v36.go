package schemaversion

// V36 migrates dashboard datasource references from string names to structured objects.
//
// This migration addresses the need to standardize datasource references across dashboards.
// Previously, datasources could be referenced as simple strings (names or UIDs), which created
// inconsistencies and made it difficult to track datasource metadata like type and API version.
//
// The migration works by:
// 1. Converting all annotation datasource references to structured objects
// 2. Migrating query-type template variable datasource references
// 3. Transforming panel-level datasource references with special handling for null values
// 4. Processing target-level datasources with inheritance logic for mixed panels
//
// This ensures consistent datasource referencing throughout the dashboard while preserving
// existing functionality. Unknown datasources are handled gracefully by creating fallback
// objects that maintain the original reference string as the UID.
//
// Example transformation:
//
// Before migration:
//
//	annotations: {
//	  list: [{ datasource: "prometheus-uid" }]
//	},
//	panels: [{
//	  datasource: "Elasticsearch",
//	  targets: [{ datasource: null }]
//	}]
//
// After migration:
//
//	annotations: {
//	  list: [{ datasource: { uid: "prometheus-uid", type: "prometheus" } }]
//	},
//	panels: [{
//	  datasource: { uid: "elasticsearch-uid", type: "elasticsearch" },
//	  targets: [{ datasource: { uid: "elasticsearch-uid", type: "elasticsearch" } }]
//	}]
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

		ds, exists := queryMap["datasource"]
		if !exists {
			continue
		}

		queryMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
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

		varType, ok := varMap["type"].(string)
		if !ok || varType != "query" {
			continue
		}

		ds, exists := varMap["datasource"]
		if !exists {
			continue
		}

		varMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
	}
}

// migratePanels updates datasource references in dashboard panels
func migratePanels(dashboard map[string]interface{}, datasources []DataSourceInfo) {
	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}
		migratePanelDatasources(panelMap, datasources)
	}
}

// migratePanelDatasources updates datasource references in a single panel and its targets
func migratePanelDatasources(panelMap map[string]interface{}, datasources []DataSourceInfo) {
	targets, hasTargets := panelMap["targets"].([]interface{})
	if !hasTargets || len(targets) == 0 {
		return
	}

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
		targetMap, ok := target.(map[string]interface{})
		if !ok {
			continue
		}

		ds, exists := targetMap["datasource"]

		// Check if target datasource is null or has no uid
		isNullOrNoUID := !exists || ds == nil
		if !isNullOrNoUID {
			dsMap, ok := ds.(map[string]interface{})
			if ok {
				uid, hasUID := dsMap["uid"]
				if !hasUID || uid == nil {
					isNullOrNoUID = true
				}
			}
		}

		if isNullOrNoUID {
			// If panel doesn't have mixed datasource, use panel's datasource
			panelDS, ok := panelMap["datasource"].(map[string]interface{})
			if !ok {
				continue
			}

			uid, hasUID := panelDS["uid"].(string)
			if hasUID && uid != "-- Mixed --" {
				targetMap["datasource"] = panelDS
			}
		} else {
			// Migrate existing target datasource
			targetDS := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
			targetMap["datasource"] = targetDS
		}

		// Update panel datasource if it was default and target is not an expression
		if !panelDataSourceWasDefault {
			continue
		}

		targetDS, ok := targetMap["datasource"].(map[string]interface{})
		if !ok {
			continue
		}

		uid, ok := targetDS["uid"].(string)
		if ok && uid != "__expr__" {
			panelMap["datasource"] = targetDS
		}
	}
}
