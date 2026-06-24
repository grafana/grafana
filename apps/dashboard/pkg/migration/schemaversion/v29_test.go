package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV29(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "query variables get migrated with refresh and options",
			input: map[string]interface{}{
				"title":         "V29 Query Variables Migration Test Dashboard",
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"type": "query", "name": "never_refresh_with_options", "options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}}, "refresh": 0},
						map[string]interface{}{"type": "query", "name": "never_refresh_without_options", "options": []interface{}{}, "refresh": 0},
						map[string]interface{}{"type": "query", "name": "dashboard_refresh_with_options", "options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "dashboard_refresh_without_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "timerange_refresh_with_options", "options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "timerange_refresh_without_options", "options": []interface{}{}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "no_refresh_with_options", "options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}}},
						map[string]interface{}{"type": "query", "name": "no_refresh_without_options", "options": []interface{}{}},
						map[string]interface{}{"type": "query", "name": "unknown_refresh_with_options", "options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}}, "refresh": 2001},
						map[string]interface{}{"type": "query", "name": "unknown_refresh_without_options", "options": []interface{}{}, "refresh": 2001},
						map[string]interface{}{"type": "custom", "name": "custom", "options": []interface{}{map[string]interface{}{"text": "custom", "value": "custom"}}},
						map[string]interface{}{"type": "textbox", "name": "textbox", "options": []interface{}{map[string]interface{}{"text": "Hello", "value": "World"}}},
						map[string]interface{}{"type": "datasource", "name": "datasource", "options": []interface{}{map[string]interface{}{"text": "ds", "value": "ds"}}},
						map[string]interface{}{"type": "interval", "name": "interval", "options": []interface{}{map[string]interface{}{"text": "1m", "value": "1m"}}},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V29 Query Variables Migration Test Dashboard",
				"schemaVersion": 29,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"type": "query", "name": "never_refresh_with_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "never_refresh_without_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "dashboard_refresh_with_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "dashboard_refresh_without_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "timerange_refresh_with_options", "options": []interface{}{}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "timerange_refresh_without_options", "options": []interface{}{}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "no_refresh_with_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "no_refresh_without_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "unknown_refresh_with_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "unknown_refresh_without_options", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "custom", "name": "custom", "options": []interface{}{map[string]interface{}{"text": "custom", "value": "custom"}}},
						map[string]interface{}{"type": "textbox", "name": "textbox", "options": []interface{}{map[string]interface{}{"text": "Hello", "value": "World"}}},
						map[string]interface{}{"type": "datasource", "name": "datasource", "options": []interface{}{map[string]interface{}{"text": "ds", "value": "ds"}}},
						map[string]interface{}{"type": "interval", "name": "interval", "options": []interface{}{map[string]interface{}{"text": "1m", "value": "1m"}}},
					},
				},
			},
		},
		{
			name: "non-query variables remain unchanged",
			input: map[string]interface{}{
				"title":         "V29 Non-Query Variables Test Dashboard",
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"type": "custom", "name": "custom", "options": []interface{}{map[string]interface{}{"text": "custom", "value": "custom"}}},
						map[string]interface{}{"type": "textbox", "name": "textbox", "options": []interface{}{map[string]interface{}{"text": "Hello", "value": "World"}}},
						map[string]interface{}{"type": "datasource", "name": "datasource", "options": []interface{}{map[string]interface{}{"text": "ds", "value": "ds"}}},
						map[string]interface{}{"type": "interval", "name": "interval", "options": []interface{}{map[string]interface{}{"text": "1m", "value": "1m"}}},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V29 Non-Query Variables Test Dashboard",
				"schemaVersion": 29,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"type": "custom", "name": "custom", "options": []interface{}{map[string]interface{}{"text": "custom", "value": "custom"}}},
						map[string]interface{}{"type": "textbox", "name": "textbox", "options": []interface{}{map[string]interface{}{"text": "Hello", "value": "World"}}},
						map[string]interface{}{"type": "datasource", "name": "datasource", "options": []interface{}{map[string]interface{}{"text": "ds", "value": "ds"}}},
						map[string]interface{}{"type": "interval", "name": "interval", "options": []interface{}{map[string]interface{}{"text": "1m", "value": "1m"}}},
					},
				},
			},
		},
		{
			name: "all query variables should have options removed",
			input: map[string]interface{}{
				"title":         "V29 Query Variables Options Removal Test Dashboard",
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"type": "query", "name": "query1", "options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}}},
						map[string]interface{}{"type": "query", "name": "query2", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query3", "options": []interface{}{map[string]interface{}{"text": "B", "value": "B"}, map[string]interface{}{"text": "C", "value": "C"}}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "query4", "options": []interface{}{map[string]interface{}{"text": "D", "value": "D"}}, "refresh": 0},
						map[string]interface{}{"type": "query", "name": "query5", "options": []interface{}{map[string]interface{}{"text": "E", "value": "E"}}, "refresh": 2001},
						map[string]interface{}{"type": "query", "name": "query6", "options": []interface{}{}},
						map[string]interface{}{"type": "query", "name": "query7", "options": []interface{}{map[string]interface{}{"text": "F", "value": "F"}}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query8", "options": []interface{}{map[string]interface{}{"text": "G", "value": "G"}}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "query9", "options": []interface{}{map[string]interface{}{"text": "H", "value": "H"}}},
						map[string]interface{}{"type": "query", "name": "query10", "options": []interface{}{map[string]interface{}{"text": "I", "value": "I"}}, "refresh": 999},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V29 Query Variables Options Removal Test Dashboard",
				"schemaVersion": 29,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"type": "query", "name": "query1", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query2", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query3", "options": []interface{}{}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "query4", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query5", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query6", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query7", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query8", "options": []interface{}{}, "refresh": 2},
						map[string]interface{}{"type": "query", "name": "query9", "options": []interface{}{}, "refresh": 1},
						map[string]interface{}{"type": "query", "name": "query10", "options": []interface{}{}, "refresh": 1},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V29)
}
