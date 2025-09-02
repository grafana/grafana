package schemaversion

import (
	"context"
	"fmt"
)

// V33 migrates panel datasource references from string names to UIDs.
//
// This migration addresses datasource references in dashboard panels and their targets
// that use the legacy string format. The migration converts these references to the new
// structured format with uid, type, and apiVersion fields.
//
// The migration works by:
// 1. Identifying datasource references in panel-level datasource fields
// 2. Converting string datasource references to structured reference objects
// 3. Migrating target-level datasource references within each panel
// 4. Handling nested panels in collapsed rows
// 5. Always setting panel datasource (even if migration returns nil)
// 6. Only setting target datasource if migration returns non-nil (preserves originals when nil)
// 7. Using returnDefaultAsNull: true (so "default" and nil become nil for panels, preserved for targets)
//
// Panel Datasource Example - String to Object:
//
// Before migration:
//
//	panel: {
//	  "datasource": "prometheus-uid",
//	  "targets": [
//	    { "refId": "A", "datasource": "elasticsearch-name" },
//	    { "refId": "B", "datasource": null }
//	  ]
//	}
//
// After migration:
//
//	panel: {
//	  "datasource": { "uid": "prometheus-uid", "type": "prometheus", "apiVersion": "v1" },
//	  "targets": [
//	    { "refId": "A", "datasource": { "uid": "elasticsearch-uid", "type": "elasticsearch", "apiVersion": "v2" } },
//	    { "refId": "B", "datasource": null }
//	  ]
//	}
//
// Default Datasource Example - Null Conversion:
//
// Before migration:
//
//	panel: {
//	  "datasource": "default",
//	  "targets": [
//	    { "refId": "A", "datasource": "default" }
//	  ]
//	}
//
// After migration:
//
//	panel: {
//	  "datasource": null,
//	  "targets": [
//	    { "refId": "A", "datasource": "default" }
//	  ]
//	}
func V33(dsInfo DataSourceInfoProvider) SchemaVersionMigrationFunc {
	return func(ctx context.Context, dashboard map[string]interface{}) error {
		datasources := dsInfo.GetDataSourceInfo(ctx)
		if dashboard == nil {
			dashboard = map[string]interface{}{}
		}
		dashboard["schemaVersion"] = int(33)

		migratePanelsV33(dashboard, datasources)

		return nil
	}
}

// migratePanelsV33 updates datasource references in dashboard panels for V33 migration
func migratePanelsV33(dashboard map[string]interface{}, datasources []DataSourceInfo) {
	if dashboard == nil {
		return
	}
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
	fmt.Println("Datasources available for migration:", datasources)
	// Handle panel datasource - always set result (even if nil)
	if result := MigrateDatasourceNameToRef(panelMap["datasource"], map[string]bool{"returnDefaultAsNull": true}, datasources); result != nil {
		panelMap["datasource"] = result
	} else {
		panelMap["datasource"] = nil
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

		// Only set target datasource if migration result is not nil
		if targetRef := MigrateDatasourceNameToRef(ds, map[string]bool{"returnDefaultAsNull": true}, datasources); targetRef != nil {
			targetMap["datasource"] = targetRef
		}
		// If targetRef is nil, leave target.datasource unchanged (preserves "default" strings, etc.)
	}
}
