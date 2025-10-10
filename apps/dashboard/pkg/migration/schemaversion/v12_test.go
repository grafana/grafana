package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV12(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "variable with refresh=true gets refresh=1",
			input: map[string]interface{}{
				"title":         "V12 Refresh True Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "refresh_true_var",
							"refresh": true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Refresh True Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "refresh_true_var",
							"refresh": 1,
						},
					},
				},
			},
		},
		{
			name: "variable with refresh=false gets refresh=0",
			input: map[string]interface{}{
				"title":         "V12 Refresh False Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "refresh_false_var",
							"refresh": false,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Refresh False Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "refresh_false_var",
							"refresh": 0,
						},
					},
				},
			},
		},
		{
			name: "variable with hideVariable=true gets hide=2",
			input: map[string]interface{}{
				"title":         "V12 Hide Variable Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "hide_variable_var",
							"hideVariable": true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Hide Variable Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "hide_variable_var",
							"hideVariable": true,
							"hide":         2,
						},
					},
				},
			},
		},
		{
			name: "variable with hideLabel=true gets hide=1",
			input: map[string]interface{}{
				"title":         "V12 Hide Label Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":      "query",
							"name":      "hide_label_var",
							"hideLabel": true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Hide Label Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":      "query",
							"name":      "hide_label_var",
							"hideLabel": true,
							"hide":      1,
						},
					},
				},
			},
		},
		{
			name: "variable with both hideVariable and hideLabel prioritizes hideVariable",
			input: map[string]interface{}{
				"title":         "V12 Hide Priority Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "priority_var",
							"hideVariable": true,
							"hideLabel":    true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Hide Priority Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "priority_var",
							"hideVariable": true,
							"hideLabel":    true,
							"hide":         2,
						},
					},
				},
			},
		},
		{
			name: "variable with no refresh or hide properties is unchanged",
			input: map[string]interface{}{
				"title":         "V12 No Properties Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type": "query",
							"name": "no_properties_var",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 No Properties Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type": "query",
							"name": "no_properties_var",
						},
					},
				},
			},
		},
		{
			name: "dashboard without templating is unchanged",
			input: map[string]interface{}{
				"title":         "V12 No Templating Test",
				"schemaVersion": 11,
			},
			expected: map[string]interface{}{
				"title":         "V12 No Templating Test",
				"schemaVersion": 12,
			},
		},
		{
			name: "dashboard with empty templating list is unchanged",
			input: map[string]interface{}{
				"title":         "V12 Empty Templating Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Empty Templating Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
			},
		},
		{
			name: "variables with hideVariable=false and hideLabel=false do not get hide property",
			input: map[string]interface{}{
				"title":         "V12 False Hide Properties Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "false_hide_var",
							"hideVariable": false,
							"hideLabel":    false,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 False Hide Properties Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "false_hide_var",
							"hideVariable": false,
							"hideLabel":    false,
						},
					},
				},
			},
		},
		{
			name: "variable with hideVariable=false but hideLabel=true gets hide=1",
			input: map[string]interface{}{
				"title":         "V12 Mixed Hide Properties Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "mixed_hide_var",
							"hideVariable": false,
							"hideLabel":    true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 Mixed Hide Properties Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "mixed_hide_var",
							"hideVariable": false,
							"hideLabel":    true,
							"hide":         1,
						},
					},
				},
			},
		},
		{
			name: "variable with all properties gets all migrations applied",
			input: map[string]interface{}{
				"title":         "V12 All Properties Test",
				"schemaVersion": 11,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "all_properties_var",
							"refresh":      true,
							"hideVariable": true,
							"hideLabel":    false,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V12 All Properties Test",
				"schemaVersion": 12,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":         "query",
							"name":         "all_properties_var",
							"refresh":      1,
							"hideVariable": true,
							"hideLabel":    false,
							"hide":         2,
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V12)
}
