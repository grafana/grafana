package testutil

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

type TestDataSourceProvider struct{}

func (m *TestDataSourceProvider) GetDataSourceInfo(_ context.Context) []schemaversion.DataSourceInfo {
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
			UID:        "testdata-ds-uid",
			Type:       "grafana-testdata-datasource",
			APIVersion: "v1",
			Name:       "TestData",
			ID:         5,
		},
		{
			Default:    false,
			UID:        "existing-ref",
			Type:       "prometheus",
			APIVersion: "v1",
			Name:       "Existing Ref Name",
			ID:         6,
		},
		{
			Default:    false,
			UID:        "-- Mixed --",
			Type:       "mixed",
			APIVersion: "v1",
			Name:       "-- Mixed --",
			ID:         7,
		},
	}
}

// GetTestDataSourceProvider returns a singleton instance of the test provider
func GetTestDataSourceProvider() *TestDataSourceProvider {
	return &TestDataSourceProvider{}
}

// DevDashboardDataSourceProvider provides datasources that match the frontend devDashboardDataSources configuration
type DevDashboardDataSourceProvider struct{}

func (m *DevDashboardDataSourceProvider) GetDataSourceInfo(_ context.Context) []schemaversion.DataSourceInfo {
	return []schemaversion.DataSourceInfo{
		{
			Default:    true,
			UID:        "testdata-type-uid",
			Type:       "grafana-testdata-datasource",
			APIVersion: "v1",
			Name:       "grafana-testdata-datasource",
			ID:         1,
		},
		{
			Default:    false,
			UID:        "testdata",
			Type:       "grafana-testdata-datasource",
			APIVersion: "v1",
			Name:       "TestData",
			ID:         2,
		},
		{
			Default:    false,
			UID:        "prometheus-uid",
			Type:       "prometheus",
			APIVersion: "v1",
			Name:       "Prometheus",
			ID:         3,
		},
		{
			Default:    false,
			UID:        "loki-uid",
			Type:       "loki",
			APIVersion: "1",
			Name:       "Loki",
			ID:         4,
		},
		{
			Default:    false,
			UID:        "elasticsearch-uid",
			Type:       "elasticsearch",
			APIVersion: "v2",
			Name:       "Elasticsearch",
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

// GetDevDashboardDataSourceProvider returns a singleton instance of the dev dashboard provider
func GetDevDashboardDataSourceProvider() *DevDashboardDataSourceProvider {
	return &DevDashboardDataSourceProvider{}
}
