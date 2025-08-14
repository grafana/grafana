package conversion

import (
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

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

	dsInfo := dsProvider.GetDataSourceInfo()

	// Find the default datasource
	for _, ds := range dsInfo {
		if ds.Default {
			return dashv2alpha1.DashboardDataSourceRef{
				Uid:  &ds.UID,
				Type: &ds.Type,
			}
		}
	}

	// If no default datasource is found, return "grafana" as fallback
	return dashv2alpha1.DashboardDataSourceRef{
		Uid:  &defaultGrafanaUID,
		Type: &defaultGrafanaType,
	}
}

// getDatasourceTypeByUID gets the datasource type by UID using the conversion module's datasource provider
func getDatasourceTypeByUID(uid string) string {
	if uid == "" {
		return *getDefaultDatasourceRef().Uid
	}

	// Get the datasource info from the conversion module's provider
	dsProvider := GetDataSourceProvider()
	if dsProvider == nil {
		return "grafana"
	}

	dsInfo := dsProvider.GetDataSourceInfo()

	// Find the datasource by UID
	for _, ds := range dsInfo {
		if ds.UID == uid {
			return ds.Type
		}
	}

	// If not found, return the default
	return *getDefaultDatasourceRef().Uid
}
