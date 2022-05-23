//go:build integration
// +build integration

package database

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
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

	t.Run("returns dashboard errDashboardIdentifierNotSet", func(t *testing.T) {
		setup()
		_, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, "")
		require.Error(t, models.ErrDashboardIdentifierNotSet, err)
	})

	t.Run("returns isPublic along with public dashboard when exists", func(t *testing.T) {
		setup()
		// insert test public dashboard
		resp, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboardConfig: models.PublicDashboardConfig{
				IsPublic: true,
				PublicDashboard: models.PublicDashboard{
					DashboardUid: savedDashboard.Uid,
					OrgId:        savedDashboard.OrgId,
				},
			},
		})
		require.NoError(t, err)

		pdc, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, resp, pdc)
	})
}

func TestSavePublicDashboard(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *DashboardStore
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		dashboardStore = ProvideDashboardStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("saves new public dashboard", func(t *testing.T) {
		setup()
		resp, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboardConfig: models.PublicDashboardConfig{
				IsPublic: true,
				PublicDashboard: models.PublicDashboard{
					DashboardUid: savedDashboard.Uid,
					OrgId:        savedDashboard.OrgId,
				},
			},
		})
		require.NoError(t, err)

		pdc, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		//verify saved response and queried response are the same
		assert.Equal(t, resp, pdc)

		// verify we have a valid uid
		assert.True(t, util.IsValidShortUID(pdc.PublicDashboard.Uid))
	})

	t.Run("returns ErrDashboardIdentifierNotSet", func(t *testing.T) {
		setup()
		_, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboardConfig: models.PublicDashboardConfig{
				IsPublic: true,
				PublicDashboard: models.PublicDashboard{
					DashboardUid: "",
					OrgId:        savedDashboard.OrgId,
				},
			},
		})
		require.Error(t, models.ErrDashboardIdentifierNotSet, err)
	})

	t.Run("overwrites existing public dashboard", func(t *testing.T) {
		setup()

		pdUid := util.GenerateShortUID()

		// insert initial record
		_, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboardConfig: models.PublicDashboardConfig{
				IsPublic: true,
				PublicDashboard: models.PublicDashboard{
					Uid:          pdUid,
					DashboardUid: savedDashboard.Uid,
					OrgId:        savedDashboard.OrgId,
				},
			},
		})
		require.NoError(t, err)

		// update initial record
		resp, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboardConfig: models.PublicDashboardConfig{
				IsPublic: false,
				PublicDashboard: models.PublicDashboard{
					Uid:           pdUid,
					DashboardUid:  savedDashboard.Uid,
					OrgId:         savedDashboard.OrgId,
					TimeVariables: "{}",
				},
			},
		})
		require.NoError(t, err)

		pdc, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, resp, pdc)
	})
}
