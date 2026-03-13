package schemaversion

import "context"

// V8 migration updates old InfluxDB query schema to the new format.
// This migration transforms the legacy InfluxDB query structure with fields, tags, and groupBy
// into the newer select-based query format.
//
// Background:
// In earlier versions, InfluxDB queries were stored using a different schema with separate
// fields, tags, and groupBy properties. This migration converts them to the newer select
// format that is more structured and easier to work with.
//
// The migration handles two cases:
// 1. Raw queries: Simply removes the fields and fill properties
// 2. Structured queries: Converts fields to select format and updates groupBy structure
//
// Example before migration (structured query):
// {
//   "schemaVersion": 7,
//   "panels": [
//     {
//       "targets": [
//         {
//           "fields": [
//             {"name": "value", "func": "mean", "mathExpr": "*2", "asExpr": "doubled"}
//           ],
//           "tags": [{"key": "host", "value": "server1"}],
//           "groupBy": [
//             {"type": "time", "interval": "1m"},
//             {"type": "tag", "key": "host"}
//           ],
//           "fill": "null"
//         }
//       ]
//     }
//   ]
// }
//
// Example after migration (structured query):
// {
//   "schemaVersion": 8,
//   "panels": [
//     {
//       "targets": [
//         {
//           "select": [
//             [
//               {"type": "field", "params": ["value"]},
//               {"type": "mean", "params": []},
//               {"type": "math", "params": ["*2"]},
//               {"type": "alias", "params": ["doubled"]}
//             ]
//           ],
//           "tags": [{"key": "host", "value": "server1"}],
//           "groupBy": [
//             {"type": "time", "params": ["1m"]},
//             {"type": "tag", "params": ["host"]},
//             {"type": "fill", "params": ["null"]}
//           ]
//         }
//       ]
//     }
//   ]
// }

func V8(_ context.Context, dashboard map[string]interface{}) error {
	dashboard["schemaVersion"] = 8

	panels, ok := dashboard["panels"].([]interface{})
	if !ok {
		return nil
	}

	for _, p := range panels {
		panel, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		targets, ok := panel["targets"].([]interface{})
		if !ok {
			continue
		}

		for _, t := range targets {
			target, ok := t.(map[string]interface{})
			if !ok {
				continue
			}

			// Check if this target has the old InfluxDB schema
			fields, hasFields := target["fields"]
			_, hasTags := target["tags"]
			groupBy, hasGroupBy := target["groupBy"]

			if !hasFields || !hasTags || !hasGroupBy {
				continue
			}

			// Check if this is a raw query
			rawQuery, isRawQuery := target["rawQuery"].(bool)
			if isRawQuery && rawQuery {
				// For raw queries, just delete fields and fill
				delete(target, "fields")
				delete(target, "fill")
			} else {
				// For structured queries, convert fields to select format
				fieldsArray, ok := fields.([]interface{})
				if ok {
					selectArray := make([]interface{}, 0, len(fieldsArray))

					for _, f := range fieldsArray {
						field, ok := f.(map[string]interface{})
						if !ok {
							continue
						}

						parts := make([]interface{}, 0)

						// Add field part
						if name, ok := field["name"].(string); ok {
							parts = append(parts, map[string]interface{}{
								"type":   "field",
								"params": []interface{}{name},
							})
						}

						// Add function part
						if funcName, ok := field["func"].(string); ok {
							parts = append(parts, map[string]interface{}{
								"type":   funcName,
								"params": []interface{}{},
							})
						}

						// Add math expression if present
						if mathExpr, ok := field["mathExpr"].(string); ok {
							parts = append(parts, map[string]interface{}{
								"type":   "math",
								"params": []interface{}{mathExpr},
							})
						}

						// Add alias if present
						if asExpr, ok := field["asExpr"].(string); ok {
							parts = append(parts, map[string]interface{}{
								"type":   "alias",
								"params": []interface{}{asExpr},
							})
						}

						if len(parts) > 0 {
							selectArray = append(selectArray, parts)
						}
					}

					target["select"] = selectArray
				}

				// Remove the old fields property
				delete(target, "fields")

				// Update groupBy format
				if groupByArray, ok := groupBy.([]interface{}); ok {
					for _, gb := range groupByArray {
						groupByPart, ok := gb.(map[string]interface{})
						if !ok {
							continue
						}

						// Convert time groupBy
						if partType, ok := groupByPart["type"].(string); ok && partType == "time" {
							if interval, ok := groupByPart["interval"].(string); ok {
								groupByPart["params"] = []interface{}{interval}
								delete(groupByPart, "interval")
							}
						}

						// Convert tag groupBy
						if partType, ok := groupByPart["type"].(string); ok && partType == "tag" {
							if key, ok := groupByPart["key"].(string); ok {
								groupByPart["params"] = []interface{}{key}
								delete(groupByPart, "key")
							}
						}
					}

					// Add fill to groupBy if present
					if fill, hasFill := target["fill"]; hasFill {
						newGroupByArray := make([]interface{}, len(groupByArray)) //nolint:prealloc
						copy(newGroupByArray, groupByArray)
						newGroupByArray = append(newGroupByArray, map[string]interface{}{
							"type":   "fill",
							"params": []interface{}{fill},
						})
						target["groupBy"] = newGroupByArray
						delete(target, "fill")
					}
				}
			}
		}
	}

	return nil
}
