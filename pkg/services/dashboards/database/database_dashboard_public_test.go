//go:build integration
// +build integration

package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// GetPublicDashboardConfig
func TestGetPublicDashboardConfig(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *DashboardStore
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		//sqlStore = sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		dashboardStore = ProvideDashboardStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("returns isPublic along with empty struct when no public dashboard", func(t *testing.T) {
		setup()
		pdc, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, &models.PublicDashboardConfig{IsPublic: false, PublicDashboard: models.PublicDashboard{}}, pdc)
	})

	t.Run("returns isPublic along with public dashboard when exists", func(t *testing.T) {

		// TODO
		// 1. add some verifications to save public dashboard so we fail if there
		// isn't an orgId or dashboardID
		// 2. jot down snippets of sqlite code that are handy in notes file
		// 3. removes comments and finish up this test method
		// 4. write tests for savePublicDashboardConfig

		setup()
		savedPublicDashboardConfig := models.PublicDashboardConfig{
			IsPublic: true,
			PublicDashboard: models.PublicDashboard{
				Uid:          "abc1234",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
			},
		}

		// insert test public dashboard
		cmd := models.SavePublicDashboardConfigCommand{
			DashboardUid:          savedDashboard.Uid,
			OrgId:                 savedDashboard.OrgId,
			PublicDashboardConfig: savedPublicDashboardConfig,
		}

		resp, err := dashboardStore.SavePublicDashboardConfig(cmd)
		require.NoError(t, err)

		err = dashboardStore.sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			// show tables in sqlite db
			//res, err := sess.Query("SELECT name FROM sqlite_master WHERE type = \"table\"")
			//if err != nil {
			//return err
			//}

			//for _, element := range res {
			//for k, ele := range element {
			//fmt.Println("Key:", k, "=>", "Element:", string(ele))
			//}
			//}

			// verify dashboard exists
			var dashboards []*models.Dashboard
			err = sess.Where("uid = ?", savedDashboard.Uid).Find(&dashboards)
			if err != nil {
				fmt.Println(err)
			}

			// verify public dashboards exist
			var publicDashboards []*models.PublicDashboard
			err = sess.Where("org_id = ? AND dashboard_uid= ?", savedDashboard.OrgId, savedDashboard.Uid).Find(&publicDashboards)
			if err != nil {
				fmt.Println(err)
			}

			fmt.Println()
			fmt.Printf("#%v", publicDashboards[0])
			return nil
		})

		if err != nil {
			panic(err)
		}

		pdc, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, resp, pdc)
	})
}

//func TestPublicDashboard(t *testing.T) {
//  var sqlStore *sqlstore.SQLStore
//  var dashboardStore *DashboardStore
//  var savedDashboard *models.Dashboard

//  setup := func() {
//    sqlStore = sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
//    dashboardStore = ProvideDashboardStore(sqlStore)
//    savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
//  }

//  t.Run("saves public dashboard", func(t *testing.T) {})

//  t.Run("returns dashboard not found", func(t *testing.T) {})
//}

// SavePublicDashboardconfig
// should generate new uid
// should replace existing uid
// fails if orgId blank
// fails if dashboardUid blank
