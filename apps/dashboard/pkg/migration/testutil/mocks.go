package testutil

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// DataSourceConfig defines different test configurations
type DataSourceConfig string

const (
	// StandardTestConfig provides datasources for standard migration tests
	StandardTestConfig DataSourceConfig = "standard"
	// DevDashboardConfig provides datasources matching dev dashboard requirements
	DevDashboardConfig DataSourceConfig = "dev-dashboard"
)

// ConfigurableDataSourceProvider provides flexible datasource configurations for different test scenarios
type ConfigurableDataSourceProvider struct {
	config DataSourceConfig
}

// NewDataSourceProvider creates a provider with the specified configuration
func NewDataSourceProvider(config DataSourceConfig) *ConfigurableDataSourceProvider {
	return &ConfigurableDataSourceProvider{config: config}
}

func (p *ConfigurableDataSourceProvider) GetDataSourceInfo(_ context.Context) []schemaversion.DataSourceInfo {
	switch p.config {
	case StandardTestConfig:
		return p.getStandardTestDataSources()
	case DevDashboardConfig:
		return p.getDevDashboardDataSources()
	default:
		return p.getStandardTestDataSources()
	}
}

// getStandardTestDataSources returns datasources for standard migration tests
func (p *ConfigurableDataSourceProvider) getStandardTestDataSources() []schemaversion.DataSourceInfo {
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
			APIVersion: "v1",
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

// getDevDashboardDataSources returns datasources for dev dashboard tests
func (p *ConfigurableDataSourceProvider) getDevDashboardDataSources() []schemaversion.DataSourceInfo {
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
			APIVersion: "", // Frontend testdata datasource has no apiVersion
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
			APIVersion: "v1",
			Name:       "Loki",
			ID:         4,
		},
		{
			Default:    false,
			UID:        "elasticsearch-uid",
			Type:       "elasticsearch",
			APIVersion: "v1",
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
