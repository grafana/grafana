package testutil

import (
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

type TestDataSourceProvider struct{}

type TestPanelProvider struct{}

func (m *TestDataSourceProvider) GetDataSourceInfo() []schemaversion.DataSourceInfo {
	return []schemaversion.DataSourceInfo{
		{
			Default:    true,
			UID:        "default-ds-uid",
			Type:       "prometheus",
			APIVersion: "v1",
			Name:       "Default Test Datasource Name",
			ID:         1,
		},
		{
			Default:    false,
			UID:        "non-default-test-ds-uid",
			Type:       "loki",
			APIVersion: "1",
			Name:       "Non Default Test Datasource Name",
			ID:         2,
		},
		{
			Default:    false,
			UID:        "existing-ref-uid",
			Type:       "prometheus",
			APIVersion: "v1",
			Name:       "Existing Ref Name",
			ID:         3,
		},
		{
			Default:    false,
			UID:        "existing-target-uid",
			Type:       "elasticsearch",
			APIVersion: "v2",
			Name:       "Existing Target Name",
			ID:         4,
		},
		{
			Default:    false,
			UID:        "existing-ref",
			Type:       "prometheus",
			APIVersion: "v1",
			Name:       "Existing Ref Name",
			ID:         5,
		},
		{
			Default:    false,
			UID:        "-- Mixed --",
			Type:       "mixed",
			APIVersion: "v1",
			Name:       "-- Mixed --",
			ID:         6,
		},
	}
}

func (m *TestPanelProvider) GetPanels() []schemaversion.PanelPluginInfo {
	return []schemaversion.PanelPluginInfo{
		{
			ID:      "gauge",
			Version: "1.0.0",
		},
		{
			ID:      "stat",
			Version: "1.0.0",
		},
		{
			ID:      "table",
			Version: "1.0.0",
		},
		// Note: grafana-singlestat-panel is not included to match frontend test environment
		// This ensures both frontend and backend migrations produce the same result
	}
}

func (m *TestPanelProvider) GetPanelPlugin(id string) schemaversion.PanelPluginInfo {
	return schemaversion.PanelPluginInfo{
		ID:      id,
		Version: "1.0.0",
	}
}

// GetTestDataSourceProvider returns a singleton instance of the test provider
func GetTestDataSourceProvider() *TestDataSourceProvider {
	return &TestDataSourceProvider{}
}

// GetTestPanelProvider returns a singleton instance of the test panel provider
func GetTestPanelProvider() *TestPanelProvider {
	return &TestPanelProvider{}
}
