package conversion

// getDefaultDatasourceType gets the default datasource type using the conversion module's datasource provider
func getDefaultDatasourceType() string {
	// Get the datasource info from the conversion module's provider
	dsProvider := GetDataSourceProvider()
	if dsProvider == nil {
		return "grafana"
	}

	dsInfo := dsProvider.GetDataSourceInfo()

	// Find the default datasource
	for _, ds := range dsInfo {
		if ds.Default {
			return ds.Type
		}
	}

	// If no default datasource is found, return "grafana" as fallback
	return "grafana"
}

// getDatasourceTypeByUID gets the datasource type by UID using the conversion module's datasource provider
func getDatasourceTypeByUID(uid string) string {
	if uid == "" {
		return getDefaultDatasourceType()
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
	return getDefaultDatasourceType()
}
