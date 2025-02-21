package schemaversion_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type mockDataSourceInfoProvider struct{}

func (m *mockDataSourceInfoProvider) GetDataSource(ctx context.Context, datasourceID int64) (*datasources.DataSource, error) {
	return &datasources.DataSource{}, nil
}

func (m *mockDataSourceInfoProvider) GetDataSourceInfo() []schemaversion.DataSourceInfo {
	return []schemaversion.DataSourceInfo{
		{
			Default:    true,
			UID:        "default-ds",
			Type:       "prometheus",
			APIVersion: "v1",
			Name:       "Default",
			ID:         1,
		},
		{
			Default:    false,
			UID:        "other-ds",
			Type:       "elasticsearch",
			APIVersion: "v2",
			Name:       "Elasticsearch",
			ID:         2,
		},
	}
}

func TestV36(t *testing.T) {
	// Create a mock DataSourceInfoProvider
	mockDsProvider := &mockDataSourceInfoProvider{}

	// Pass the mock provider to V36
	migration := schemaversion.V36(mockDsProvider)

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
