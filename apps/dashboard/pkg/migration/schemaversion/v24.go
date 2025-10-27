package schemaversion

import (
	"context"
)

// V24 migration handles setting autoMigrateFrom
// This is a hacky way that matches frontend's logic
// For reason see https://github.com/grafana/grafana/pull/102146
// The issue is that if panel is "table" and it has styles, it should be migrated to "table-old"

// Example before migration:
// {
// 	"id": 4,
// 	"type": "table",
// 	"title": "Table with Timeseries to Rows Transform",
// 	"description": "Tests migration of timeseries_to_rows transform to seriesToRows transformation.",
// 	"styles": [
// 		{
// 			"pattern": "/.*/",
// 			"unit": "short"
// 		}
// 	],
// 	"transform": "timeseries_to_rows",
// 	"targets": [{ "refId": "A" }]
// }
//
// Example after migration:
// {
// 	"autoMigrateFrom": "table-old",
// 	"datasource": {
// 	  "apiVersion": "v1",
// 	  "type": "prometheus",
// 	  "uid": "default-ds-uid"
// 	},
// 	"description": "Tests migration of timeseries_to_rows transform to seriesToRows transformation.",
// 	"id": 4,
// 	"styles": [
// 	  {
// 		"pattern": "/.*/",
// 		"unit": "short"
// 	  }
// 	],
// 	"targets": [
// 	  {
// 		"datasource": {
// 		  "apiVersion": "v1",
// 		  "type": "prometheus",
// 		  "uid": "default-ds-uid"
// 		},
// 		"refId": "A"
// 	  }
// 	],
// 	"title": "Table with Timeseries to Rows Transform",
// 	"transform": "timeseries_to_rows",
// 	"type": "table"
//   }

func V24(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 24

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, panel := range panels {
		panelMap, ok := panel.(map[string]interface{})
		if !ok {
			continue
		}

		wasAngularTable := panelMap["type"] == "table"
		wasReactTable := panelMap["table"] == "table2"

		if wasAngularTable && panelMap["styles"] == nil {
			continue
		}

		if !wasAngularTable || wasReactTable {
			continue
		}

		var currentType string
		if wasAngularTable {
			currentType = "table-old"
		} else {
			currentType = "table"
		}

		if currentType == "table-old" {
			panelMap["autoMigrateFrom"] = "table-old"
			panelMap["type"] = "table"
		}
	}

	return nil
}
