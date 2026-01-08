package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV21(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "panel with data links gets migrated",
			input: map[string]interface{}{
				"title":         "V21 Data Links Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with data links",
						"id":    1,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?series=${__series.labels}&${__series.labels.a}",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V21 Data Links Migration Test Dashboard",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with data links",
						"id":    1,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?series=${__field.labels}&${__field.labels.a}",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with field options links gets migrated",
			input: map[string]interface{}{
				"title":         "V21 Field Options Links Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with field options links",
						"id":    2,
						"options": map[string]interface{}{
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://mylink.com?series=${__series.labels}&${__series.labels.x}",
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V21 Field Options Links Migration Test Dashboard",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with field options links",
						"id":    2,
						"options": map[string]interface{}{
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://mylink.com?series=${__field.labels}&${__field.labels.x}",
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
			name: "panel with both data links and field options links gets migrated",
			input: map[string]interface{}{
				"title":         "V21 Both Links Migration Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with both link types",
						"id":    3,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?series=${__series.labels}",
								},
							},
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://mylink.com?field=${__series.labels}",
										},
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V21 Both Links Migration Test Dashboard",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with both link types",
						"id":    3,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?series=${__field.labels}",
								},
							},
							"fieldOptions": map[string]interface{}{
								"defaults": map[string]interface{}{
									"links": []interface{}{
										map[string]interface{}{
											"url": "http://mylink.com?field=${__field.labels}",
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
			name: "panel without __series.labels is unchanged",
			input: map[string]interface{}{
				"title":         "V21 No Series Labels Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel without series labels",
						"id":    4,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?other=${__field.labels}",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V21 No Series Labels Test Dashboard",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel without series labels",
						"id":    4,
						"options": map[string]interface{}{
							"dataLinks": []interface{}{
								map[string]interface{}{
									"url": "http://mylink.com?other=${__field.labels}",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel without options is unchanged",
			input: map[string]interface{}{
				"title":         "V21 No Options Test Dashboard",
				"schemaVersion": 20,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel without options",
						"id":    5,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V21 No Options Test Dashboard",
				"schemaVersion": 21,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel without options",
						"id":    5,
					},
				},
			},
		},
		{
			name: "dashboard without panels is unchanged",
			input: map[string]interface{}{
				"title":         "V21 No Panels Test Dashboard",
				"schemaVersion": 20,
			},
			expected: map[string]interface{}{
				"title":         "V21 No Panels Test Dashboard",
				"schemaVersion": 21,
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V21)
}
