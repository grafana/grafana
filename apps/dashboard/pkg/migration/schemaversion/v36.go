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

// getDataSourceRef creates a datasource reference object with uid, type and optional apiVersion
func getDataSourceRef(ds *DataSourceInfo) map[string]interface{} {
	if ds == nil {
		return nil
	}
	ref := map[string]interface{}{
		"uid":  ds.UID,
		"type": ds.Type,
	}
	if ds.APIVersion != "" {
		ref["apiVersion"] = ds.APIVersion
	}
	return ref
}

// getDefaultDSInstanceSettings returns the default datasource if one exists
func getDefaultDSInstanceSettings(datasources []DataSourceInfo) *DataSourceInfo {
	for _, ds := range datasources {
		if ds.Default {
			return &DataSourceInfo{
				UID:        ds.UID,
				Type:       ds.Type,
				Name:       ds.Name,
				APIVersion: ds.APIVersion,
			}
		}
	}
	return nil
}

// getInstanceSettings looks up a datasource by name or uid reference
func getInstanceSettings(nameOrRef interface{}, datasources []DataSourceInfo) *DataSourceInfo {
	if nameOrRef == nil || nameOrRef == "default" {
		return getDefaultDSInstanceSettings(datasources)
	}

	for _, ds := range datasources {
		if str, ok := nameOrRef.(string); ok {
			if str == ds.Name || str == ds.UID {
				return &DataSourceInfo{
					UID:        ds.UID,
					Type:       ds.Type,
					Name:       ds.Name,
					APIVersion: ds.APIVersion,
				}
			}
		}
		if ref, ok := nameOrRef.(map[string]interface{}); ok {
			if uid, hasUID := ref["uid"]; hasUID {
				if uid == ds.UID {
					return &DataSourceInfo{
						UID:        ds.UID,
						Type:       ds.Type,
						Name:       ds.Name,
						APIVersion: ds.APIVersion,
					}
				}
			}
		}
	}
	return nil
}

// migrateDatasourceNameToRef converts a datasource name/uid string to a reference object
// Matches the frontend migrateDatasourceNameToRef function in DashboardMigrator.ts
func migrateDatasourceNameToRef(nameOrRef interface{}, options map[string]bool, datasources []DataSourceInfo) map[string]interface{} {
	if options["returnDefaultAsNull"] && (nameOrRef == nil || nameOrRef == "default") {
		return nil
	}

	if dsRef, ok := nameOrRef.(map[string]interface{}); ok {
		if _, hasUID := dsRef["uid"]; hasUID {
			return dsRef
		}
	}

	ds := getInstanceSettings(nameOrRef, datasources)
	if ds != nil {
		return getDataSourceRef(ds)
	}

	if dsName, ok := nameOrRef.(string); ok && dsName != "" {
		return map[string]interface{}{
			"uid": dsName,
		}
	}

	return nil
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
			queryMap["datasource"] = migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
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
				varMap["datasource"] = migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
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
				defaultDS := getDefaultDSInstanceSettings(datasources)
				panelMap["datasource"] = getDataSourceRef(defaultDS)
				panelDataSourceWasDefault = true
			} else {
				panelMap["datasource"] = migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources)
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
					targetDS := migrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
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
