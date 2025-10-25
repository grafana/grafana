package conversion

import (
	"context"

	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// DataSourceProvider interface for getting datasource information
type DataSourceProvider interface {
	GetDataSourceByUID(uid string) *DataSourceInfo
	GetDefaultDataSource() DataSourceInfo
}

// DataSourceInfo contains information about a datasource
type DataSourceInfo struct {
	UID  string
	Type string
}

// DataSourceProviderAdapter adapts the schemaversion.DataSourceInfoProvider to the conversion DataSourceProvider
type DataSourceProviderAdapter struct {
	provider  schemaversion.DataSourceInfoProvider
	dsMap     map[string]schemaversion.DataSourceInfo
	defaultDS *schemaversion.DataSourceInfo
}

// NewDataSourceProviderAdapter creates a new adapter
func NewDataSourceProviderAdapter(provider schemaversion.DataSourceInfoProvider) *DataSourceProviderAdapter {
	dsMap := make(map[string]schemaversion.DataSourceInfo)
	var defaultDS *schemaversion.DataSourceInfo

	// Pre-load all datasources into a map for quick lookup
	datasources := provider.GetDataSourceInfo(context.Background())
	for _, ds := range datasources {
		dsMap[ds.UID] = ds
		if ds.Default {
			dsRef := ds
			defaultDS = &dsRef
		}
	}

	// If no default was found, fallback to Grafana
	if defaultDS == nil {
		defaultDS = &schemaversion.DataSourceInfo{
			UID:  "-- Grafana --",
			Type: "grafana",
		}
	}

	return &DataSourceProviderAdapter{
		provider:  provider,
		dsMap:     dsMap,
		defaultDS: defaultDS,
	}
}

// GetDataSourceByUID returns datasource info for a given UID
func (a *DataSourceProviderAdapter) GetDataSourceByUID(uid string) *DataSourceInfo {
	if ds, ok := a.dsMap[uid]; ok {
		return &DataSourceInfo{
			UID:  ds.UID,
			Type: ds.Type,
		}
	}
	return nil
}

// GetDefaultDataSource returns the default datasource info
func (a *DataSourceProviderAdapter) GetDefaultDataSource() DataSourceInfo {
	return DataSourceInfo{
		UID:  a.defaultDS.UID,
		Type: a.defaultDS.Type,
	}
}

var globalDataSourceProvider DataSourceProvider

// SetDataSourceProvider sets the global datasource provider
func SetDataSourceProvider(provider schemaversion.DataSourceInfoProvider) {
	globalDataSourceProvider = NewDataSourceProviderAdapter(provider)
}

// GetDataSourceProvider returns the datasource provider for the conversion module
func GetDataSourceProvider() DataSourceProvider {
	return globalDataSourceProvider
}

// getDefaultDatasourceType gets the default datasource type using the conversion module's datasource provider
func getDefaultDatasourceRef() dashv2alpha1.DashboardDataSourceRef {
	defaultGrafanaUID := "-- Grafana --"
	defaultGrafanaType := "grafana"
	// Get the datasource info from the conversion module's provider
	dsProvider := GetDataSourceProvider()
	if dsProvider == nil {
		return dashv2alpha1.DashboardDataSourceRef{
			Uid:  &defaultGrafanaUID,
			Type: &defaultGrafanaType,
		}
	}

	dsInfo := dsProvider.GetDefaultDataSource()

	// Return the datasource info
	return dashv2alpha1.DashboardDataSourceRef{
		Uid:  &dsInfo.UID,
		Type: &dsInfo.Type,
	}
}

// getDatasourceTypeByUID gets the datasource type by UID using the conversion module's datasource provider
func getDatasourceTypeByUID(uid string) string {
	if uid == "" {
		return *getDefaultDatasourceRef().Type
	}

	// Get the datasource info from the conversion module's provider
	dsProvider := GetDataSourceProvider()
	if dsProvider == nil {
		return "grafana"
	}

	dsInfo := dsProvider.GetDataSourceByUID(uid)

	// Check if the datasource was found
	if dsInfo != nil {
		return dsInfo.Type
	}

	// If not found, return the default type
	return *getDefaultDatasourceRef().Type
}
