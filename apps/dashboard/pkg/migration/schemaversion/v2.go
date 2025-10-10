package schemaversion

import "context"

// V2 migrates dashboard from schema version 0 or 1 to 2.
// This migration handles the legacy services.filter structure and early panel format changes.
// It matches the frontend DashboardMigrator.ts logic for oldVersion < 2 && finalTargetVersion >= 2.
//
// Key migrations:
// 1. Services filter migration: old.services.filter.time -> dashboard.time
// 2. Services filter migration: old.services.filter.list -> dashboard.templating.list
// 3. Panel type conversion: "graphite" -> "graph"
// 4. Legend boolean to object conversion: {legend: true} -> {legend: {show: true}}
// 5. Grid property migrations: grid.min -> grid.leftMin, grid.max -> grid.leftMax
// 6. Y-format migrations: y_format -> y_formats[0], y2_format -> y_formats[1]
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
//	  },
//	  "panels": [
//	    {
//	      "type": "graphite",
//	      "legend": true,
//	      "grid": {"min": 0, "max": 100},
//	      "y_format": "short",
//	      "y2_format": "bytes"
//	    }
//	  ]
//	}
//
// Example after migration:
//
//	{
//	  "schemaVersion": 2,
//	  "time": {"from": "now-1h", "to": "now"},
//	  "templating": {
//	    "list": [{"name": "var1", "type": "query"}]
//	  },
//	  "panels": [
//	    {
//	      "type": "graph",
//	      "legend": {"show": true},
//	      "grid": {"leftMin": 0, "leftMax": 100},
//	      "y_formats": ["short", "bytes"]
//	    }
//	  ]
//	}
func V2(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 2

	// Migrate services.filter structure
	migrateServicesFilter(dashboard)

	// Apply panel upgrades
	panels, ok := dashboard["panels"].([]interface{})
	if ok {
		for _, p := range panels {
			panel, ok := p.(map[string]interface{})
			if !ok {
				continue
			}
			upgradePanel(panel)
		}
	}

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

// upgradePanel applies panel-specific upgrades for V2 migration
func upgradePanel(panel map[string]interface{}) {
	// Panel type conversion: graphite -> graph
	wasOriginallyGraphite := false
	if panelType, ok := panel["type"].(string); ok && panelType == "graphite" {
		panel["type"] = "graph"
		wasOriginallyGraphite = true
	}

	// Only apply graph-specific migrations to panels that are currently graph type
	// AND were originally graphite (to match frontend behavior where originally-graph panels
	// are auto-migrated to timeseries before V2 migration runs)
	panelType := GetStringValue(panel, "type")
	if panelType != "graph" || !wasOriginallyGraphite {
		return
	}

	// Legend boolean to object conversion
	migrateLegendProperty(panel)

	// Grid property migrations
	migrateGridProperties(panel)

	// Y-format migrations
	migrateYFormats(panel)
}

// migrateLegendProperty converts boolean legend to object format
func migrateLegendProperty(panel map[string]interface{}) {
	if legend, ok := panel["legend"]; ok {
		if legendBool, ok := legend.(bool); ok {
			panel["legend"] = map[string]interface{}{
				"show": legendBool,
			}
		}
	}
}

// migrateGridProperties migrates grid.min/max to grid.leftMin/leftMax
// Note: This matches the frontend's behavior which has a bug where min=0 is not converted
// due to JavaScript's falsy check: if (panel.grid.min)
func migrateGridProperties(panel map[string]interface{}) {
	grid, ok := panel["grid"].(map[string]interface{})
	if !ok {
		return
	}

	// Migrate grid.min to grid.leftMin (but skip if value is 0 to match frontend bug)
	if min, ok := grid["min"]; ok {
		// Frontend uses if (panel.grid.min) which is falsy for 0
		// We need to match this buggy behavior
		if minFloat, ok := min.(float64); ok && minFloat != 0 {
			grid["leftMin"] = min
			delete(grid, "min")
		} else if minInt, ok := min.(int); ok && minInt != 0 {
			grid["leftMin"] = min
			delete(grid, "min")
		}
	}

	// Migrate grid.max to grid.leftMax (works correctly for all values)
	if max, ok := grid["max"]; ok {
		grid["leftMax"] = max
		delete(grid, "max")
	}
}

// migrateYFormats migrates y_format and y2_format to y_formats array
func migrateYFormats(panel map[string]interface{}) {
	var yFormats []interface{}
	hasYFormat := false

	// Check for y_format
	if yFormat, ok := panel["y_format"]; ok {
		if len(yFormats) == 0 {
			yFormats = make([]interface{}, 2)
		}
		yFormats[0] = yFormat
		delete(panel, "y_format")
		hasYFormat = true
	}

	// Check for y2_format
	if y2Format, ok := panel["y2_format"]; ok {
		if len(yFormats) == 0 {
			yFormats = make([]interface{}, 2)
		}
		yFormats[1] = y2Format
		delete(panel, "y2_format")
		hasYFormat = true
	}

	// Only set y_formats if we found at least one format
	if hasYFormat {
		panel["y_formats"] = yFormats
	}
}
