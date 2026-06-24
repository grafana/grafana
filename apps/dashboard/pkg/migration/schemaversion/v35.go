package schemaversion

import "context"

// V35 ensures x-axis visibility in timeseries panels to prevent dashboard breakage.
//
// This migration addresses a specific issue where timeseries panels with all axes
// configured as hidden (axisPlacement: "hidden") would result in completely unusable
// visualizations, as users would lose the ability to see time progression along the x-axis.
//
// The migration works by:
// 1. Identifying timeseries panels where the default axis placement is set to "hidden"
// 2. Adding a field override that specifically targets time-type fields (x-axis)
// 3. Setting the axis placement for time fields to "auto" to ensure x-axis visibility
//
// This preserves the original intent of hiding other axes while maintaining the critical
// time axis that makes timeseries data comprehensible. The override uses field matching
// by type ("time") to selectively restore visibility only for temporal data.
//
// Example transformation:
//
// Before migration:
//
//	fieldConfig: {
//	  defaults: { custom: { axisPlacement: "hidden" } },
//	  overrides: []
//	}
//
// After migration:
//
//	fieldConfig: {
//	  defaults: { custom: { axisPlacement: "hidden" } },
//	  overrides: [{
//	    matcher: { id: "byType", options: "time" },
//	    properties: [{ id: "custom.axisPlacement", value: "auto" }]
//	  }]
//	}
func V35(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = int(35)

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		p, ok := panel.(map[string]interface{})
		if !ok || p["type"] != "timeseries" {
			continue
		}

		applyXAxisVisibilityOverride(p)
	}

	return nil
}

// applyXAxisVisibilityOverride adds a field override to ensure x-axis visibility
// when the panel's default axis placement is set to hidden.
func applyXAxisVisibilityOverride(panel map[string]interface{}) {
	fieldConfig, ok := panel["fieldConfig"].(map[string]interface{})
	if !ok {
		// Only process panels that already have fieldConfig (matches frontend behavior)
		return
	}

	defaults, _ := fieldConfig["defaults"].(map[string]interface{})
	custom, _ := defaults["custom"].(map[string]interface{})

	if custom["axisPlacement"] != "hidden" {
		return
	}

	overrides, _ := fieldConfig["overrides"].([]interface{})
	fieldConfig["overrides"] = append(overrides, map[string]interface{}{
		"matcher": map[string]interface{}{
			"id":      "byType",
			"options": "time",
		},
		"properties": []interface{}{
			map[string]interface{}{
				"id":    "custom.axisPlacement",
				"value": "auto",
			},
		},
	})
}
