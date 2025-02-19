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
			name: "dashboard with annotations",
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
			name: "dashboard with template variables",
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
			name: "dashboard with panels",
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
	}

	runMigrationTests(t, tests, migration)
}
