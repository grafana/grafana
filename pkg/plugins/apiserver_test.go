package plugins

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUtils(t *testing.T) {
	// all other datasources use plugin ID as prefix (as long as is valid)
	require.Equal(t, "name.datasource.grafana.app", getIDIgnoreError("name"), "single word is accepted")
	require.Equal(t, "name-datasource.datasource.grafana.app", getIDIgnoreError("name-datasource"), "multiple words are accepted with '-datasource' suffix")
	require.Error(t, getErrorIgnoreValue("org-name"), "multiple words are not accepted without '-datasource' suffix")
	require.Equal(t, "org-name-datasource.datasource.grafana.app", getIDIgnoreError("org-name-datasource"))
	require.Equal(t, "org-name-more-datasource.datasource.grafana.app", getIDIgnoreError("org-name-more-datasource"))

	// testdata gets special treatment
	require.Equal(t, "testdata.datasource.grafana.app", getIDIgnoreError("grafana-testdata-datasource"))
	require.Equal(t, "testdata.datasource.grafana.app", getIDIgnoreError("testdata-datasource"))

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
