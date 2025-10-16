package schemaversion

import "context"

// V2 migrates dashboard from schema version 0 or 1 to 2.
// This migration handles the legacy services.filter structure.
// It matches the frontend DashboardMigrator.ts logic for oldVersion < 2 && finalTargetVersion >= 2.
//
// Key migrations:
// 1. Services filter migration: old.services.filter.time -> dashboard.time
// 2. Services filter migration: old.services.filter.list -> dashboard.templating.list
//
// Example before migration:
//
//	{
//	  "schemaVersion": 1,
//	  "services": {
//	    "filter": {
//	      "time": {"from": "now-1h", "to": "now"},
//	      "list": [{"name": "var1", "type": "query"}]
//	    }
//	  }
//	}
//
// Example after migration:
//
//	{
//	  "schemaVersion": 2,
//	  "time": {"from": "now-1h", "to": "now"},
//	  "templating": {
//	    "list": [{"name": "var1", "type": "query"}]
//	  }
//	}
func V2(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 2

	// Migrate services.filter structure
	migrateServicesFilter(dashboard)

	return nil
}

// migrateServicesFilter migrates the legacy services.filter structure
func migrateServicesFilter(dashboard map[string]interface{}) {
	services, ok := dashboard["services"].(map[string]interface{})
	if !ok {
		return
	}

	filter, ok := services["filter"].(map[string]interface{})
	if !ok {
		return
	}

	// Migrate time property
	if time, ok := filter["time"]; ok {
		dashboard["time"] = time
	}

	// Migrate templating list
	if list, ok := filter["list"]; ok {
		if _, exists := dashboard["templating"]; !exists {
			dashboard["templating"] = map[string]interface{}{}
		}
		templating := dashboard["templating"].(map[string]interface{})
		templating["list"] = list
	}

	// Remove the services property after migration
	delete(dashboard, "services")
}
