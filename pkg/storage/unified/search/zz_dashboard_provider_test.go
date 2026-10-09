package search

import (
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	dashboardapp "github.com/grafana/grafana/apps/dashboard/pkg/apis"
)

// dashboardSearchFieldsProvider builds the dashboard kind's search-field
// provider from its manifest, the way production does, for seeding a test
// registry.
func DashboardSearchFieldsProviderForTest() searchmodel.SearchFieldsProvider {
	return searchmodel.NewManifestBackedProvider(dashboardapp.LocalManifest().ManifestData)
}
