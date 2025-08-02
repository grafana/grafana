package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestV36(t *testing.T) {
	// Pass the mock provider to V36
	migration := schemaversion.V36(testutil.GetTestDataSourceProvider())

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
			name: "panel with null datasource and targets should get default datasource",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
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
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with null datasource and empty targets array should get default datasource and targets",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         2,
						"datasource": nil,
						"targets":    []interface{}{},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 2,
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with null datasource and no targets property should get default datasource and targets",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         3,
						"datasource": nil,
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"panels": []interface{}{
					map[string]interface{}{
						"id": 3,
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
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
								"refId":      "A",
								"datasource": "existing-target-uid",
							},
							map[string]interface{}{
								"refId":      "B",
								"datasource": "existing-ref-uid",
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
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "existing-target-uid",
									"apiVersion": "v2",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "existing-ref-uid",
									"apiVersion": "v1",
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
						"datasource": "existing-ref-uid",
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"datasource": nil,
							},
							map[string]interface{}{
								"refId": "B",
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
							"uid":        "existing-ref-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "existing-ref-uid",
									"apiVersion": "v1",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "existing-ref-uid",
									"apiVersion": "v1",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with null datasource should inherit from target datasource (panelDataSourceWasDefault logic)",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"datasource": "existing-target-uid",
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
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "existing-target-uid",
									"apiVersion": "v2",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with expression queries should not inherit panel datasource from expression",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"datasource": "existing-target-uid",
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid":  "__expr__",
									"type": "__expr__",
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
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "existing-target-uid",
									"apiVersion": "v2",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid":  "__expr__",
									"type": "__expr__",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with unknown datasource name should preserve as UID",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "unknown-datasource",
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"datasource": "another-unknown-ds",
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
							"uid": "unknown-datasource",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid": "another-unknown-ds",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "nested panels in collapsed row should be migrated",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"datasource": "existing-ref-uid",
								"targets": []interface{}{
									map[string]interface{}{
										"refId":      "A",
										"datasource": nil,
									},
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
						"type": "row",
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
						},
						"panels": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "existing-ref-uid",
									"apiVersion": "v1",
								},
								"targets": []interface{}{
									map[string]interface{}{
										"refId": "A",
										"datasource": map[string]interface{}{
											"type":       "prometheus",
											"uid":        "existing-ref-uid",
											"apiVersion": "v1",
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
			name: "annotations should migrate datasource references with returnDefaultAsNull: false",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "Default Annotation",
							"datasource": "default",
						},
						map[string]interface{}{
							"name":       "Named Datasource Annotation",
							"datasource": "Existing Target Name",
						},
						map[string]interface{}{
							"name":       "UID Datasource Annotation",
							"datasource": "existing-target-uid",
						},
						map[string]interface{}{
							"name":       "Null Datasource Annotation",
							"datasource": nil,
						},
						map[string]interface{}{
							"name":       "Unknown Datasource Annotation",
							"datasource": "unknown-ds",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "Default Annotation",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds-uid",
								"apiVersion": "v1",
							},
						},
						map[string]interface{}{
							"name": "Named Datasource Annotation",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"name": "UID Datasource Annotation",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"name": "Null Datasource Annotation",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds-uid",
								"apiVersion": "v1",
							},
						},
						map[string]interface{}{
							"name": "Unknown Datasource Annotation",
							"datasource": map[string]interface{}{
								"uid": "unknown-ds",
							},
						},
					},
				},
			},
		},
		{
			name: "template variables should migrate query variables only",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":       "query",
							"name":       "query_var_null",
							"datasource": nil,
						},
						map[string]interface{}{
							"type":       "query",
							"name":       "query_var_named",
							"datasource": "Existing Target Name",
						},
						map[string]interface{}{
							"type":       "query",
							"name":       "query_var_uid",
							"datasource": "existing-target-uid",
						},
						map[string]interface{}{
							"type":       "constant",
							"name":       "non_query_var",
							"datasource": nil,
						},
						map[string]interface{}{
							"type":       "query",
							"name":       "query_var_unknown",
							"datasource": "unknown-ds",
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
							"name": "query_var_null",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds-uid",
								"apiVersion": "v1",
							},
						},
						map[string]interface{}{
							"type": "query",
							"name": "query_var_named",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"type": "query",
							"name": "query_var_uid",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"type":       "constant",
							"name":       "non_query_var",
							"datasource": nil,
						},
						map[string]interface{}{
							"type": "query",
							"name": "query_var_unknown",
							"datasource": map[string]interface{}{
								"uid": "unknown-ds",
							},
						},
					},
				},
			},
		},
		{
			name: "comprehensive migration scenario matching integration test structure",
			input: map[string]interface{}{
				"schemaVersion": 35,
				"title":         "Datasource Reference Migration Test Dashboard",
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "Default Annotation",
							"datasource": "default",
						},
						map[string]interface{}{
							"name":       "Named Datasource Annotation",
							"datasource": "Existing Target Name",
						},
						map[string]interface{}{
							"name":       "UID Datasource Annotation",
							"datasource": "existing-target-uid",
						},
						map[string]interface{}{
							"name":       "Null Datasource Annotation",
							"datasource": nil,
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "query_var_null",
							"type":       "query",
							"datasource": nil,
						},
						map[string]interface{}{
							"name":       "query_var_named",
							"type":       "query",
							"datasource": "Existing Target Name",
						},
						map[string]interface{}{
							"name":       "query_var_uid",
							"type":       "query",
							"datasource": "existing-target-uid",
						},
						map[string]interface{}{
							"name":       "non_query_var",
							"type":       "constant",
							"datasource": nil,
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"title":      "Panel with Null Datasource and Targets",
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"datasource": nil,
							},
						},
					},
					map[string]interface{}{
						"id":         2,
						"title":      "Panel with Null Datasource and Empty Targets",
						"datasource": nil,
						"targets":    []interface{}{},
					},
					map[string]interface{}{
						"id":         3,
						"title":      "Panel with No Targets Array",
						"datasource": nil,
					},
					map[string]interface{}{
						"id":    4,
						"title": "Panel with Mixed Datasources",
						"datasource": map[string]interface{}{
							"uid": "-- Mixed --",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId":      "A",
								"datasource": nil,
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid": "existing-target-uid",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    5,
						"title": "Panel with Existing Object Datasource",
						"datasource": map[string]interface{}{
							"uid":  "existing-ref",
							"type": "prometheus",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid":  "existing-target-uid",
									"type": "loki",
								},
							},
						},
					},
					map[string]interface{}{
						"id":         7,
						"title":      "Panel with Expression Query",
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid": "existing-target-uid",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid":  "__expr__",
									"type": "__expr__",
								},
							},
						},
					},
					map[string]interface{}{
						"id":         8,
						"title":      "Panel Inheriting from Target",
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid": "existing-target-uid",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 36,
				"title":         "Datasource Reference Migration Test Dashboard",
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "Default Annotation",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds-uid",
								"apiVersion": "v1",
							},
						},
						map[string]interface{}{
							"name": "Named Datasource Annotation",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"name": "UID Datasource Annotation",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"name": "Null Datasource Annotation",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds-uid",
								"apiVersion": "v1",
							},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "query_var_null",
							"type": "query",
							"datasource": map[string]interface{}{
								"type":       "prometheus",
								"uid":        "default-ds-uid",
								"apiVersion": "v1",
							},
						},
						map[string]interface{}{
							"name": "query_var_named",
							"type": "query",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"name": "query_var_uid",
							"type": "query",
							"datasource": map[string]interface{}{
								"type":       "elasticsearch",
								"uid":        "existing-target-uid",
								"apiVersion": "v2",
							},
						},
						map[string]interface{}{
							"name":       "non_query_var",
							"type":       "constant",
							"datasource": nil,
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel with Null Datasource and Targets",
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    2,
						"title": "Panel with Null Datasource and Empty Targets",
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    3,
						"title": "Panel with No Targets Array",
						"datasource": map[string]interface{}{
							"type":       "prometheus",
							"uid":        "default-ds-uid",
							"apiVersion": "v1",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    4,
						"title": "Panel with Mixed Datasources",
						"datasource": map[string]interface{}{
							"uid": "-- Mixed --",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"type":       "prometheus",
									"uid":        "default-ds-uid",
									"apiVersion": "v1",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid": "existing-target-uid",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    5,
						"title": "Panel with Existing Object Datasource",
						"datasource": map[string]interface{}{
							"uid":  "existing-ref",
							"type": "prometheus",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid":  "existing-target-uid",
									"type": "loki",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    7,
						"title": "Panel with Expression Query",
						"datasource": map[string]interface{}{
							"uid": "existing-target-uid",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid": "existing-target-uid",
								},
							},
							map[string]interface{}{
								"refId": "B",
								"datasource": map[string]interface{}{
									"uid":  "__expr__",
									"type": "__expr__",
								},
							},
						},
					},
					map[string]interface{}{
						"id":    8,
						"title": "Panel Inheriting from Target",
						"datasource": map[string]interface{}{
							"uid": "existing-target-uid",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"refId": "A",
								"datasource": map[string]interface{}{
									"uid": "existing-target-uid",
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
