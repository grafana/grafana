package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
)

func TestIntegrationDashboardProvisioningTest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore, cfg := db.InitTestDBWithCfg(t)
	dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore))
	require.NoError(t, err)

	folderCmd := dashboards.SaveDashboardCommand{
		OrgID:     1,
		FolderUID: "",
		IsFolder:  true,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":    nil,
			"title": "test dashboard",
		}),
	}

	dash, err := dashboardStore.SaveDashboard(context.Background(), folderCmd)
	require.Nil(t, err)

	saveDashboardCmd := dashboards.SaveDashboardCommand{
		OrgID:     1,
		IsFolder:  false,
		FolderUID: dash.UID,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":    nil,
			"title": "test dashboard 2",
		}),
	}

	t.Run("Saving dashboards with provisioning meta data", func(t *testing.T) {
		now := time.Now()

		provisioning := &dashboards.DashboardProvisioning{
			Name:       "default",
			ExternalID: "/var/grafana.json",
			Updated:    now.Unix(),
		}

		dash, err := dashboardStore.SaveProvisionedDashboard(context.Background(), saveDashboardCmd, provisioning)
		require.Nil(t, err)
		require.NotNil(t, dash)
		require.NotEqual(t, 0, dash.ID)
		dashId := dash.ID

		t.Run("Can query for provisioned dashboards", func(t *testing.T) {
			rslt, err := dashboardStore.GetProvisionedDashboardData(context.Background(), "default")
			require.Nil(t, err)

			require.Equal(t, 1, len(rslt))
			require.Equal(t, dashId, rslt[0].DashboardID)
			require.Equal(t, now.Unix(), rslt[0].Updated)
		})

		t.Run("Can query for one provisioned dashboard", func(t *testing.T) {
			data, err := dashboardStore.GetProvisionedDataByDashboardID(context.Background(), dash.ID)
			require.Nil(t, err)
			require.NotNil(t, data)
		})

		t.Run("Can query for none provisioned dashboard", func(t *testing.T) {
			data, err := dashboardStore.GetProvisionedDataByDashboardID(context.Background(), 3000)
			require.Nil(t, err)
			require.Nil(t, data)
		})

		t.Run("Deleting folder should delete provision meta data", func(t *testing.T) {
			deleteCmd := &dashboards.DeleteDashboardCommand{
				ID:    dash.ID,
				OrgID: 1,
			}

			require.Nil(t, dashboardStore.DeleteDashboard(context.Background(), deleteCmd))

			data, err := dashboardStore.GetProvisionedDataByDashboardID(context.Background(), dash.ID)
			require.Nil(t, err)
			require.Nil(t, data)
		})

		t.Run("UnprovisionDashboard should delete provisioning metadata", func(t *testing.T) {
			require.Nil(t, dashboardStore.UnprovisionDashboard(context.Background(), dashId))

			data, err := dashboardStore.GetProvisionedDataByDashboardID(context.Background(), dashId)
			require.Nil(t, err)
			require.Nil(t, data)
		})
	})
}
