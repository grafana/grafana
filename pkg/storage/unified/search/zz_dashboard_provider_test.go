package search

import (
	"github.com/grafana/grafana-app-sdk/app"

	dashboardapp "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// dashboardSearchFieldsProvider builds the dashboard kind's search-field
// provider from its manifest, the way production does, for seeding a test
// registry.
func DashboardSearchFieldsProviderForTest() resource.SearchFieldsProvider {
	return resource.NewManifestBackedProvider([]app.Manifest{dashboardapp.LocalManifest()})
}
