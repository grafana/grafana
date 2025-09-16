package schemaversion

import "context"

// V36 migrates dashboard datasource references from legacy string format to structured UID-based objects.
//
// This migration addresses a critical evolution in Grafana's datasource architecture where datasource
// identification shifted from potentially ambiguous display names to reliable UIDs. The original format
// used string references that could break when datasources were renamed, moved between organizations,
// or when multiple datasources shared similar names. This created reliability and portability issues
// for dashboard sharing and automation workflows.
//
// The migration works by:
// 1. Processing annotations, template variables, and panels (including nested panels in rows)
// 2. Converting string datasource references to structured objects containing uid, type, and apiVersion
// 3. Handling null/missing datasource references by setting appropriate defaults
// 4. Maintaining consistency between panel and target datasource configurations
// 5. Preserving special datasource types like Mixed datasources and expression queries
//
// This transformation provides several critical benefits:
// - Eliminates datasource reference breakage when datasources are renamed
// - Enables reliable dashboard export/import across different Grafana instances
// - Supports advanced datasource features that require type and version information
// - Prepares the schema for future datasource management enhancements
// - Maintains backward compatibility while establishing a robust foundation
//
// The migration handles complex scenarios including:
// - Panels with missing datasource configuration (set to default)
// - Mixed datasource panels with heterogeneous targets
// - Expression queries that reference other queries
// - Template variables that depend on datasource queries
// - Annotation queries from various datasource types
//
// Example transformations:
//
// Before migration (string reference):
//
//	datasource: "prometheus-prod"
//	// or
//	datasource: null
//
// After migration (structured object):
//
//	datasource: {
//	  uid: "prometheus-uid-123",
//	  type: "prometheus",
//	  apiVersion: "v1"
//	}
//
// Before migration (panel with targets):
//
//	panel: {
//	  datasource: "CloudWatch",
//	  targets: [{
//	    datasource: null,
//	    refId: "A"
//	  }]
//	}
//
// After migration (consistent references):
//
//	panel: {
//	  datasource: {
//	    uid: "cloudwatch-uid-456",
//	    type: "cloudwatch",
//	    apiVersion: "v1"
//	  },
//	  targets: [{
//	    datasource: {
//	      uid: "cloudwatch-uid-456",
//	      type: "cloudwatch",
//	      apiVersion: "v1"
//	    },
//	    refId: "A"
//	  }]
//	}
func V36(dsInfo DataSourceInfoProvider) SchemaVersionMigrationFunc {
	return func(ctx context.Context, dashboard map[string]interface{}) error {
		datasources := dsInfo.GetDataSourceInfo(ctx)
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

		// Always migrate datasource, even if it doesn't exist (will be set to default)
		ds := queryMap["datasource"]
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

	defaultDS := GetDefaultDSInstanceSettings(datasources)
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
		// Handle null datasource variables by setting to default
		if !exists || ds == nil {
			varMap["datasource"] = GetDataSourceRef(defaultDS)
		} else {
			varMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
		}
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
			migratePanelDatasources(np, datasources)
		}
	}
}

// migratePanelDatasources updates datasource references in a single panel and its targets
func migratePanelDatasources(panelMap map[string]interface{}, datasources []DataSourceInfo) {
	// NOTE: Even though row panels don't technically need datasource or targets fields,
	// we process them anyway to exactly match frontend behavior and avoid inconsistencies
	// between frontend and backend migrations. The frontend DashboardMigrator processes
	// all panels uniformly without special row panel handling.

	defaultDS := GetDefaultDSInstanceSettings(datasources)
	panelDataSourceWasDefault := false

	// Handle targets - treat empty arrays same as missing targets (matches frontend behavior)
	targets, hasTargets := panelMap["targets"].([]interface{})
	if !hasTargets || len(targets) == 0 {
		targets = []interface{}{
			map[string]interface{}{
				"refId": "A",
			},
		}
		panelMap["targets"] = targets
		hasTargets = true
	}

	// Handle panel datasource
	ds, exists := panelMap["datasource"]
	if !exists || ds == nil {
		// Set to default if panel has targets (matches frontend logic)
		panelMap["datasource"] = GetDataSourceRef(defaultDS)
		panelDataSourceWasDefault = true
	} else {
		// Migrate existing non-null datasource (should be null after V33)
		migrated := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources)
		if migrated == nil {
			// If migration returned nil, set to default
			panelMap["datasource"] = GetDataSourceRef(defaultDS)
			panelDataSourceWasDefault = true
		} else {
			panelMap["datasource"] = migrated
		}
	}

	// Handle target datasources
	if !hasTargets {
		return
	}

	for _, target := range targets {
		targetMap, ok := target.(map[string]interface{})
		if !ok {
			continue
		}

		ds, exists := targetMap["datasource"]

		// Check if target datasource is null, missing, or has no uid
		needsDefault := false
		if !exists || ds == nil {
			needsDefault = true
		} else if dsMap, ok := ds.(map[string]interface{}); ok {
			uid, hasUID := dsMap["uid"]
			if !hasUID || uid == nil {
				needsDefault = true
			}
		}

		if needsDefault {
			// Use panel's datasource if it's not mixed
			panelDS, ok := panelMap["datasource"].(map[string]interface{})
			if ok {
				uid, hasUID := panelDS["uid"].(string)
				if hasUID && uid != "-- Mixed --" {
					targetMap["datasource"] = panelDS
				} else {
					// If panel is mixed, migrate target datasource independently
					targetMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
				}
			}
		} else {
			// Migrate existing target datasource
			targetMap["datasource"] = MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": false}, datasources)
		}

		// Update panel datasource if it was default and target is not an expression
		if panelDataSourceWasDefault {
			targetDS, ok := targetMap["datasource"].(map[string]interface{})
			if ok {
				uid, ok := targetDS["uid"].(string)
				if ok && uid != "__expr__" {
					panelMap["datasource"] = targetDS
				}
			}
		}
	}
}
