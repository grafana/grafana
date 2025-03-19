package e2e

import (
	"testing"

	gapi "github.com/grafana/grafana-api-golang-client"
	"github.com/stretchr/testify/require"
)

func TestUnifiedStorage(t *testing.T) {
	// TODO: remove this line when ci pipeline is ready
	t.Skip("skipping e2e test")

	t.Run("Create folder and dashboard", func(t *testing.T) {
		s, err := NewUnifiedScenario()
		require.NoError(t, err)

		postgres := s.NewPostgresService("postgres")
		require.NoError(t, s.Scenario.StartAndWaitReady(postgres))

		storage, err := s.NewStorageService("storage")
		require.NoError(t, err)
		require.NoError(t, s.Scenario.StartAndWaitReady(storage))

		grafana, err := s.NewGrafanaService("grafana", storage.GRPCEndpoint())
		require.NoError(t, err)
		require.NoError(t, s.Scenario.StartAndWaitReady(grafana))

		const org1 = 1
		gorg1, err := s.NewGrafanaClient("grafana", org1)
		require.NoError(t, err)

		folderOrg1, err := gorg1.NewFolder("test-folder-1")
		require.NoError(t, err)

		const uid = "test-dashboard-1"
		dashboard := gapi.Dashboard{
			Model: map[string]interface{}{
				"uid":   uid,
				"title": "Test Dashboard 1",
			},
			FolderID:  folderOrg1.ID,
			FolderUID: folderOrg1.UID,
			Overwrite: false,
			Message:   "Test Dashboard 1",
		}

		dashboardOrg1, err := gorg1.NewDashboard(dashboard)
		require.NoError(t, err)

		newDashboard, err := gorg1.DashboardByUID(uid)
		require.NoError(t, err)
		require.Equal(t, dashboardOrg1.UID, newDashboard.Model["uid"])

		newFolder, err := gorg1.Folder(folderOrg1.ID)
		require.NoError(t, err)
		require.Equal(t, folderOrg1.UID, newFolder.UID)

		require.NoError(t, s.Scenario.Stop(grafana, storage, postgres))
	})
}
