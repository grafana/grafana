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
		{
			Default:    false,
			UID:        "influx-uid",
			Type:       "influxdb",
			APIVersion: "v1",
			Name:       "InfluxDB Test Datasource",
			ID:         7,
		},
		{
			Default:    false,
			UID:        "cloudwatch-uid",
			Type:       "cloudwatch",
			APIVersion: "v1",
			Name:       "CloudWatch Test Datasource",
			ID:         8,
		},
		{
			Default:    false,
			UID:        "-- Grafana --",
			Type:       "grafana",
			APIVersion: "v1",
			Name:       "-- Grafana --",
			ID:         9,
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

// FakeLibraryPanelProvider provides a fake implementation of LibraryPanelInfoProvider for testing
type FakeLibraryPanelProvider struct {
	panels map[string]map[string]interface{}
}

// NewFakeLibraryPanelProvider creates a new fake library panel provider
func NewFakeLibraryPanelProvider() *FakeLibraryPanelProvider {
	return &FakeLibraryPanelProvider{
		panels: make(map[string]map[string]interface{}),
	}
}

// AddPanelModel adds a panel model for a given UID
func (p *FakeLibraryPanelProvider) AddPanelModel(uid string, model map[string]interface{}) {
	p.panels[uid] = model
}

// GetPanelModelByUID returns the panel model for a library panel by its UID
func (p *FakeLibraryPanelProvider) GetPanelModelByUID(_ context.Context, uid string) (map[string]interface{}, error) {
	if model, ok := p.panels[uid]; ok {
		return model, nil
	}
	return nil, nil
}

// NewStandardLibraryPanelProvider creates a library panel provider with standard test library panel models
// This includes library panels used in test fixtures for repeat options testing
func NewStandardLibraryPanelProvider() *FakeLibraryPanelProvider {
	provider := NewFakeLibraryPanelProvider()

	// Add library panel models for the test fixture v1beta1.library-panel-repeat.json
	provider.AddPanelModel("lib-panel-no-repeat", map[string]interface{}{
		"type":  "timeseries",
		"title": "Library Panel No Repeat",
	})
	provider.AddPanelModel("lib-panel-with-repeat", map[string]interface{}{
		"type":   "timeseries",
		"title":  "Library Panel With Repeat",
		"repeat": "server",
	})
	provider.AddPanelModel("lib-panel-repeat-h", map[string]interface{}{
		"type":            "timeseries",
		"title":           "Library Panel Repeat Horizontal",
		"repeat":          "server",
		"repeatDirection": "h",
	})
	provider.AddPanelModel("lib-panel-repeat-complete", map[string]interface{}{
		"type":            "timeseries",
		"title":           "Library Panel Repeat Complete",
		"repeat":          "server",
		"repeatDirection": "h",
		"maxPerRow":       3,
	})

	return provider
}
