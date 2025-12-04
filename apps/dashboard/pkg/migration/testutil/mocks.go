package testutil

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// EmptyLibraryElementProvider provides an empty library element list for tests
type EmptyLibraryElementProvider struct{}

// NewLibraryElementProvider creates a new empty library element provider for tests
func NewLibraryElementProvider() *EmptyLibraryElementProvider {
	return &EmptyLibraryElementProvider{}
}

// GetLibraryElementInfo returns an empty list for tests
func (p *EmptyLibraryElementProvider) GetLibraryElementInfo(_ context.Context) []schemaversion.LibraryElementInfo {
	return []schemaversion.LibraryElementInfo{}
}

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

// Index builds the index directly from the datasources
func (p *ConfigurableDataSourceProvider) Index(ctx context.Context) *schemaversion.DatasourceIndex {
	datasources := p.GetDataSourceInfo(ctx)
	return schemaversion.NewDatasourceIndex(datasources)
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

// TestLibraryElementProvider provides library elements with models for testing repeat options migration
type TestLibraryElementProvider struct {
	elements []schemaversion.LibraryElementInfo
}

// NewTestLibraryElementProvider creates a new test library element provider with sample library panels
func NewTestLibraryElementProvider() *TestLibraryElementProvider {
	// Create library panel models with repeat options
	libPanelWithRepeatH := map[string]any{
		"id":              1,
		"type":            "timeseries",
		"title":           "Library Panel with Horizontal Repeat",
		"repeat":          "server",
		"repeatDirection": "h",
		"maxPerRow":       3,
		"gridPos": map[string]any{
			"x": 0,
			"y": 0,
			"w": 12,
			"h": 8,
		},
		"targets": []any{},
		"options": map[string]any{},
	}

	libPanelWithRepeatV := map[string]any{
		"id":              2,
		"type":            "stat",
		"title":           "Library Panel with Vertical Repeat",
		"repeat":          "datacenter",
		"repeatDirection": "v",
		"gridPos": map[string]any{
			"x": 0,
			"y": 0,
			"w": 6,
			"h": 4,
		},
		"targets": []any{},
		"options": map[string]any{},
	}

	libPanelWithoutRepeat := map[string]any{
		"id":    3,
		"type":  "text",
		"title": "Library Panel without Repeat",
		"gridPos": map[string]any{
			"x": 0,
			"y": 0,
			"w": 6,
			"h": 3,
		},
		"targets": []any{},
		"options": map[string]any{},
	}

	// Convert models to Unstructured
	modelWithRepeatH := v0alpha1.Unstructured{Object: libPanelWithRepeatH}
	modelWithRepeatV := v0alpha1.Unstructured{Object: libPanelWithRepeatV}
	modelWithoutRepeat := v0alpha1.Unstructured{Object: libPanelWithoutRepeat}

	return &TestLibraryElementProvider{
		elements: []schemaversion.LibraryElementInfo{
			{
				UID:         "lib-panel-repeat-h",
				Name:        "Library Panel with Horizontal Repeat",
				Kind:        1, // Panel element
				Type:        "timeseries",
				Description: "A library panel with horizontal repeat options",
				FolderUID:   "",
				Model:       modelWithRepeatH,
			},
			{
				UID:         "lib-panel-repeat-v",
				Name:        "Library Panel with Vertical Repeat",
				Kind:        1, // Panel element
				Type:        "stat",
				Description: "A library panel with vertical repeat options",
				FolderUID:   "",
				Model:       modelWithRepeatV,
			},
			{
				UID:         "lib-panel-no-repeat",
				Name:        "Library Panel without Repeat",
				Kind:        1, // Panel element
				Type:        "text",
				Description: "A library panel without repeat options",
				FolderUID:   "",
				Model:       modelWithoutRepeat,
			},
		},
	}
}

// GetLibraryElementInfo returns the test library elements
func (p *TestLibraryElementProvider) GetLibraryElementInfo(_ context.Context) []schemaversion.LibraryElementInfo {
	return p.elements
}
