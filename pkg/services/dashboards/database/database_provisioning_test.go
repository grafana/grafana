package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
)

func TestIntegrationDashboardProvisioningTest(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
	require.NoError(t, err)

	folderCmd := dashboards.SaveDashboardCommand{
		OrgID:    1,
		FolderID: 0,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "test dashboard",
		}),
	}

	dash, err := dashboardStore.SaveDashboard(context.Background(), folderCmd)
	require.Nil(t, err)

	saveDashboardCmd := dashboards.SaveDashboardCommand{
		OrgID:    1,
		IsFolder: false,
		FolderID: dash.ID,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "test dashboard",
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

		t.Run("Deleting orphaned provisioned dashboards", func(t *testing.T) {
			saveCmd := dashboards.SaveDashboardCommand{
				OrgID:    1,
				IsFolder: false,
				FolderID: dash.ID,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"id":    nil,
					"title": "another_dashboard",
				}),
			}
			provisioning := &dashboards.DashboardProvisioning{
				Name:       "another_reader",
				ExternalID: "/var/grafana.json",
				Updated:    now.Unix(),
			}

			anotherDash, err := dashboardStore.SaveProvisionedDashboard(context.Background(), saveCmd, provisioning)
			require.Nil(t, err)

			query := &dashboards.GetDashboardsQuery{DashboardIDs: []int64{anotherDash.ID}}
			queryResult, err := dashboardStore.GetDashboards(context.Background(), query)
			require.Nil(t, err)
			require.NotNil(t, queryResult)

			deleteCmd := &dashboards.DeleteOrphanedProvisionedDashboardsCommand{ReaderNames: []string{"default"}}
			require.Nil(t, dashboardStore.DeleteOrphanedProvisionedDashboards(context.Background(), deleteCmd))

			query = &dashboards.GetDashboardsQuery{DashboardIDs: []int64{dash.ID, anotherDash.ID}}
			queryResult, err = dashboardStore.GetDashboards(context.Background(), query)
			require.Nil(t, err)

			require.Equal(t, 1, len(queryResult))
			require.Equal(t, dashId, queryResult[0].ID)
		})

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
