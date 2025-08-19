package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV20(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with data links gets variable syntax migrated",
			input: map[string]interface{}{
				"title":         "V20 Data Links Variable Syntax Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with data links",
						"id":    1,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?series=$__series_name&time=__value_time&field=__field_name",
								},
								map[string]interface{}{
									"url": "http://another.com?series=${__series_name}&field=${__field_name}",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 Data Links Variable Syntax Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with data links",
						"id":    1,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?series=${__series.name}&time=__value.time&field=__field.name",
								},
								map[string]interface{}{
									"url": "http://another.com?series=${__series.name}&field=${__field.name}",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with field options title gets variable syntax migrated",
			input: map[string]interface{}{
				"title":         "V20 Field Options Title Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with field options title",
						"id":    2,
						"options": map[string]interface{}{
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"title": "Series: __series_name, Field: $__field_name, Time: __value_time",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 Field Options Title Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with field options title",
						"id":    2,
						"options": map[string]interface{}{
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"title": "Series: __series.name, Field: ${__field.name}, Time: __value.time",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with field options links gets variable syntax migrated",
			input: map[string]interface{}{
				"title":         "V20 Field Options Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "gauge",
						"title": "Panel with field options links",
						"id":    3,
						"options": map[string]interface{}{
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://example.com?series=__series_name&field=$__field_name",
										},
										map[string]interface{}{
											"url": "http://test.com?time=__value_time",
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 Field Options Links Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "gauge",
						"title": "Panel with field options links",
						"id":    3,
						"options": map[string]interface{}{
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://example.com?series=__series.name&field=${__field.name}",
										},
										map[string]interface{}{
											"url": "http://test.com?time=__value.time",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with both data links and field options gets variable syntax migrated",
			input: map[string]interface{}{
				"title":         "V20 Combined Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with both data links and field options",
						"id":    4,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://datalink.com?series=$__series_name",
								},
							},
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"title": "Field Name: __field_name",
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://fieldlink.com?field=$__field_name&time=__value_time",
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 Combined Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "table",
						"title": "Panel with both data links and field options",
						"id":    4,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://datalink.com?series=${__series.name}",
								},
							},
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"title": "Field Name: __field.name",
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://fieldlink.com?field=${__field.name}&time=__value.time",
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel without data links or field options remains unchanged",
			input: map[string]interface{}{
				"title":         "V20 No Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Panel without links",
						"id":    5,
						"options": map[string]interface{}{
							"someOtherOption": "value",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 No Links Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Panel without links",
						"id":    5,
						"options": map[string]interface{}{
							"someOtherOption": "value",
						},
					},
				},
			},
		},
		{
			name: "dashboard without panels remains unchanged",
			input: map[string]interface{}{
				"title":         "V20 No Panels Migration Test Dashboard",
				"schemaVersion": 19,
			},
			expected: map[string]interface{}{
				"title":         "V20 No Panels Migration Test Dashboard",
				"schemaVersion": 20,
			},
		},
		{
			name: "panel with empty data links array remains unchanged",
			input: map[string]interface{}{
				"title":         "V20 Empty Data Links Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with empty data links",
						"id":    6,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 Empty Data Links Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with empty data links",
						"id":    6,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{},
						},
					},
				},
			},
		},
		{
			name: "panel with legacy variables that don't need migration",
			input: map[string]interface{}{
				"title":         "V20 No Legacy Variables Migration Test Dashboard",
				"schemaVersion": 19,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "text",
						"title": "Panel with modern variables",
						"id":    7,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://modern.com?series=${__series.name}&field=${__field.name}",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V20 No Legacy Variables Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "text",
						"title": "Panel with modern variables",
						"id":    7,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://modern.com?series=${__series.name}&field=${__field.name}",
								},
							},
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V20)
}
