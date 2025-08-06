package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestV33(t *testing.T) {
	// Pass the mock provider to V33
	migration := schemaversion.V33(testutil.GetTestProvider())

	tests := []migrationTestCase{
		{
			name: "dashboard with no panels",
			input: map[string]interface{}{
				"schemaVersion": 32,
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
			},
		},
		{
			name: "panel with default datasource should return null",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "default",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "default",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "default",
							},
						},
					},
				},
			},
		},
		{
			name: "panel with null datasource should return null",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": nil,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": nil,
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": nil,
							},
						},
					},
				},
			},
		},
		{
			name: "panel with existing datasource reference should be preserved",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"uid":  "existing-uid",
							"type": "existing-type",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"uid":  "target-uid",
									"type": "target-type",
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"uid":  "existing-uid",
							"type": "existing-type",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"uid":  "target-uid",
									"type": "target-type",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with datasource by name should be migrated",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Existing Target Name",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "Existing Target Name",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
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
			name: "panel with datasource by UID should be migrated",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "existing-target-uid",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "existing-target-uid",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
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
			name: "panel with unknown datasource should preserve as UID",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "unknown-datasource",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "unknown-datasource",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"uid": "unknown-datasource",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"uid": "unknown-datasource",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel with mixed datasources",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Existing Target Name",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "default",
							},
							map[string]interface{}{
								"datasource": "existing-target-uid",
							},
							map[string]interface{}{
								"datasource": "unknown-ds",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "default",
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type":       "elasticsearch",
									"uid":        "existing-target-uid",
									"apiVersion": "v2",
								},
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"uid": "unknown-ds",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "panel without targets should not fail",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Existing Target Name",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
					},
				},
			},
		},
		{
			name: "nested panels in collapsed rows should be migrated",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "row",
						"collapsed":  true,
						"datasource": "Existing Target Name",
						"panels": []interface{}{
							map[string]interface{}{
								"datasource": "default",
								"targets": []interface{}{
									map[string]interface{}{
										"datasource": "existing-target-uid",
									},
								},
							},
							map[string]interface{}{
								"datasource": "unknown-ds",
								"targets": []interface{}{
									map[string]interface{}{
										"datasource": "Existing Target Name",
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"type":      "row",
						"collapsed": true,
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"panels": []interface{}{
							map[string]interface{}{
								"datasource": nil,
								"targets": []interface{}{
									map[string]interface{}{
										"datasource": map[string]interface{}{
											"type":       "elasticsearch",
											"uid":        "existing-target-uid",
											"apiVersion": "v2",
										},
									},
								},
							},
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"uid": "unknown-ds",
								},
								"targets": []interface{}{
									map[string]interface{}{
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
			},
		},

		{
			name: "targets with lowercase default keyword should not be updated",
			input: map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": "Existing Target Name",
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "default",
							},
							map[string]interface{}{
								"datasource": nil,
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 33,
				"panels": []interface{}{
					map[string]interface{}{
						"datasource": map[string]interface{}{
							"type":       "elasticsearch",
							"uid":        "existing-target-uid",
							"apiVersion": "v2",
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": "default",
							},
							map[string]interface{}{
								"datasource": nil,
							},
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, migration)
}
