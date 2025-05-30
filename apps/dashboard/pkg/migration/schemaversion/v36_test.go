package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestV36(t *testing.T) {
	// Pass the mock provider to V36
	migration := schemaversion.V36(testutil.GetTestProvider())

	tests := []migrationTestCase{
		{
			name: "dashboard with no datasources",
			input: map[string]interface{}{
				"schemaVersion": 35,
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
			},
		},
		{
			name: "panel with null datasource should get default datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds",
									"apiVersion": "v1",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with mixed datasources should preserve target datasources",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"uid": "-- Mixed --",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "Elasticsearch",
							},
							map[string]interface{}{
								"datasource": "other-ds",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"uid": "-- Mixed --",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with specific datasource should apply to targets without datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Default",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": nil,
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"uid": nil,
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds",
									"apiVersion": "v1",
								},
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds",
									"apiVersion": "v1",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with annotations using default datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": "Default",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds",
								"apiVersion": "v1",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with annotations using non-default datasource by UID",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": "other-ds",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "other-ds",
								"apiVersion": "v2",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with annotations using non-default datasource by name",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": "Elasticsearch",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "other-ds",
								"apiVersion": "v2",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with template variables using default datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":       "query",
							"datasource": nil,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type": "query",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds",
								"apiVersion": "v1",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with template variables using non-default datasource by UID",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":       "query",
							"datasource": "other-ds",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type": "query",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "other-ds",
								"apiVersion": "v2",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with template variables using non-default datasource by name",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":       "query",
							"datasource": "Elasticsearch",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type": "query",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "other-ds",
								"apiVersion": "v2",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with panels using default datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Default",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "Default",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds",
									"apiVersion": "v1",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with panels using non-default datasource by UID",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "other-ds",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "other-ds",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "other-ds",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with panels using non-default datasource by name",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Elasticsearch",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "Elasticsearch",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "other-ds",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard with mixed panel and target datasources",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Default",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "Elasticsearch",
							},
							map[string]interface{}{
								"datasource": "other-ds",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with null datasource and expression queries should get default datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid": "__expr__",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds",
									"apiVersion": "v1",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid": "__expr__",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with null datasource should inherit from query datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "Elasticsearch",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "other-ds",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "other-ds",
									"apiVersion": "v2",
								},
							},
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, migration)
}
