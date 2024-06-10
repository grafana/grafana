package plugins

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUtils(t *testing.T) {
	// multiple flavors of the same idea
	require.Equal(t, "tempo.datasource.grafana.app", getIDIgnoreError("tempo"))
	require.Equal(t, "tempo.datasource.grafana.app", getIDIgnoreError("grafana-tempo-datasource"))
	require.Equal(t, "tempo.datasource.grafana.app", getIDIgnoreError("tempo-datasource"))

	// Multiple dashes in the name
	require.Equal(t, "org-name.datasource.grafana.app", getIDIgnoreError("org-name-datasource"))
	require.Equal(t, "org-name-more.datasource.grafana.app", getIDIgnoreError("org-name-more-datasource"))
	require.Equal(t, "org-name-more-more.datasource.grafana.app", getIDIgnoreError("org-name-more-more-datasource"))

	require.Error(t, getErrorIgnoreValue("graph-panel"))
	require.Error(t, getErrorIgnoreValue("anything-notdatasource"))
}

func getIDIgnoreError(id string) string {
	v, _ := GetDatasourceGroupNameFromPluginID(id)
	return v
}

func getErrorIgnoreValue(id string) error {
	_, err := GetDatasourceGroupNameFromPluginID(id)
	return err
}
