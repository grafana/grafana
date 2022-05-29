//go:build integration
// +build integration

package database

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func TestIntegrationDashboardProvisioningTest(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := ProvideDashboardStore(sqlStore)

	folderCmd := models.SaveDashboardCommand{
		OrgId:    1,
		FolderId: 0,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "test dashboard",
		}),
	}

	dash, err := dashboardStore.SaveDashboard(folderCmd)
	require.Nil(t, err)

	saveDashboardCmd := models.SaveDashboardCommand{
		OrgId:    1,
		IsFolder: false,
		FolderId: dash.Id,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "test dashboard",
		}),
	}

	t.Run("Saving dashboards with provisioning meta data", func(t *testing.T) {
		now := time.Now()

		provisioning := &models.DashboardProvisioning{
			Name:       "default",
			ExternalId: "/var/grafana.json",
			Updated:    now.Unix(),
		}

		dash, err := dashboardStore.SaveProvisionedDashboard(saveDashboardCmd, provisioning)
		require.Nil(t, err)
		require.NotNil(t, dash)
		require.NotEqual(t, 0, dash.Id)
		dashId := dash.Id

		t.Run("Deleting orphaned provisioned dashboards", func(t *testing.T) {
			saveCmd := models.SaveDashboardCommand{
				OrgId:    1,
				IsFolder: false,
				FolderId: dash.Id,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"id":    nil,
					"title": "another_dashboard",
				}),
			}
			provisioning := &models.DashboardProvisioning{
				Name:       "another_reader",
				ExternalId: "/var/grafana.json",
				Updated:    now.Unix(),
			}

			anotherDash, err := dashboardStore.SaveProvisionedDashboard(saveCmd, provisioning)
			require.Nil(t, err)

			query := &models.GetDashboardsQuery{DashboardIds: []int64{anotherDash.Id}}
			err = dashboardStore.GetDashboards(context.Background(), query)
			require.Nil(t, err)
			require.NotNil(t, query.Result)

			deleteCmd := &models.DeleteOrphanedProvisionedDashboardsCommand{ReaderNames: []string{"default"}}
			require.Nil(t, dashboardStore.DeleteOrphanedProvisionedDashboards(context.Background(), deleteCmd))

			query = &models.GetDashboardsQuery{DashboardIds: []int64{dash.Id, anotherDash.Id}}
			err = dashboardStore.GetDashboards(context.Background(), query)
			require.Nil(t, err)

			require.Equal(t, 1, len(query.Result))
			require.Equal(t, dashId, query.Result[0].Id)
		})

		t.Run("Can query for provisioned dashboards", func(t *testing.T) {
			rslt, err := dashboardStore.GetProvisionedDashboardData("default")
			require.Nil(t, err)

			require.Equal(t, 1, len(rslt))
			require.Equal(t, dashId, rslt[0].DashboardId)
			require.Equal(t, now.Unix(), rslt[0].Updated)
		})

		t.Run("Can query for one provisioned dashboard", func(t *testing.T) {
			data, err := dashboardStore.GetProvisionedDataByDashboardID(dash.Id)
			require.Nil(t, err)
			require.NotNil(t, data)
		})

		t.Run("Can query for none provisioned dashboard", func(t *testing.T) {
			data, err := dashboardStore.GetProvisionedDataByDashboardID(3000)
			require.Nil(t, err)
			require.Nil(t, data)
		})

		t.Run("Deleting folder should delete provision meta data", func(t *testing.T) {
			deleteCmd := &models.DeleteDashboardCommand{
				Id:    dash.Id,
				OrgId: 1,
			}

			require.Nil(t, dashboardStore.DeleteDashboard(context.Background(), deleteCmd))

			data, err := dashboardStore.GetProvisionedDataByDashboardID(dash.Id)
			require.Nil(t, err)
			require.Nil(t, data)
		})

		t.Run("UnprovisionDashboard should delete provisioning metadata", func(t *testing.T) {
			require.Nil(t, dashboardStore.UnprovisionDashboard(context.Background(), dashId))

			data, err := dashboardStore.GetProvisionedDataByDashboardID(dashId)
			require.Nil(t, err)
			require.Nil(t, data)
		})
	})
}
