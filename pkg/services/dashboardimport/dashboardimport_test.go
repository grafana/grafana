package dashboardimport

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImportDashboardRequestFolderSelection(t *testing.T) {
	t.Run("marshal omits zero value folder fields", func(t *testing.T) {
		data, err := json.Marshal(ImportDashboardRequest{PluginId: "test-plugin"})
		require.NoError(t, err)

		var fields map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(data, &fields))
		require.NotContains(t, fields, "folderId")
		require.NotContains(t, fields, "folderUid")
	})

	t.Run("unmarshal distinguishes omitted folder from explicit root", func(t *testing.T) {
		var omitted ImportDashboardRequest
		require.NoError(t, json.Unmarshal([]byte(`{"pluginId":"test-plugin"}`), &omitted))
		require.False(t, omitted.HasFolderSelection())
		require.False(t, omitted.HasFolderUIDSelection())

		var explicitUIDRoot ImportDashboardRequest
		require.NoError(t, json.Unmarshal([]byte(`{"pluginId":"test-plugin","folderUid":""}`), &explicitUIDRoot))
		require.True(t, explicitUIDRoot.HasFolderSelection())
		require.True(t, explicitUIDRoot.HasFolderUIDSelection())

		var explicitIDRoot ImportDashboardRequest
		require.NoError(t, json.Unmarshal([]byte(`{"pluginId":"test-plugin","folderId":0}`), &explicitIDRoot))
		require.True(t, explicitIDRoot.HasFolderSelection())
		require.False(t, explicitIDRoot.HasFolderUIDSelection())
	})
}
