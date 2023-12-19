package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUtils(t *testing.T) {
	// multiple flavors of the same idea
	require.Equal(t, "tempo.datasource.grafana.app", getDatasourceGroupNameFromPluginID("tempo"))
	require.Equal(t, "tempo.datasource.grafana.app", getDatasourceGroupNameFromPluginID("grafana-tempo-datasource"))
	require.Equal(t, "tempo.datasource.grafana.app", getDatasourceGroupNameFromPluginID("tempo-datasource"))

	// Multiple dashes in the name
	require.Equal(t, "org-name.datasource.grafana.app", getDatasourceGroupNameFromPluginID("org-name-datasource"))
	require.Equal(t, "org-name-more.datasource.grafana.app", getDatasourceGroupNameFromPluginID("org-name-more-datasource"))
	require.Equal(t, "org-name-more-more.datasource.grafana.app", getDatasourceGroupNameFromPluginID("org-name-more-more-datasource"))

	require.Equal(t, "*** InvalidDatasourceGroupName: graph-panel***", getDatasourceGroupNameFromPluginID("graph-panel"))
	require.Equal(t, "*** InvalidDatasourceGroupName: anything-notdatasource***", getDatasourceGroupNameFromPluginID("anything-notdatasource"))
}
