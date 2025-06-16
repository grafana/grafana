package testutil

import "github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"

type TestDataSourceProvider struct{}

func (m *TestDataSourceProvider) GetDataSourceInfo() []schemaversion.DataSourceInfo {
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

// GetTestProvider returns a singleton instance of the test provider
func GetTestProvider() *TestDataSourceProvider {
	return &TestDataSourceProvider{}
}
