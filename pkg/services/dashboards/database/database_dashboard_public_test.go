package database

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var TimeSettings, _ = simplejson.NewJson([]byte(`{"from": "now-12", "to": "now"}`))

// GetPublicDashboard
func TestIntegrationGetPublicDashboard(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *DashboardStore
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		dashboardStore = ProvideDashboardStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("returns PublicDashboard and Dashboard", func(t *testing.T) {
		setup()
		pubdash, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc1234",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: TimeSettings,
			},
		})
		require.NoError(t, err)

		pd, d, err := dashboardStore.GetPublicDashboard("abc1234")
		require.NoError(t, err)
		assert.Equal(t, pd, pubdash)
		assert.Equal(t, d.Uid, pubdash.DashboardUid)
	})

	t.Run("returns ErrPublicDashboardNotFound with empty uid", func(t *testing.T) {
		setup()
		_, _, err := dashboardStore.GetPublicDashboard("")
		require.Error(t, models.ErrPublicDashboardIdentifierNotSet, err)
	})

	t.Run("returns ErrPublicDashboardNotFound when PublicDashboard not found", func(t *testing.T) {
		setup()
		_, _, err := dashboardStore.GetPublicDashboard("zzzzzz")
		require.Error(t, models.ErrPublicDashboardNotFound, err)
	})

	t.Run("returns ErrDashboardNotFound when Dashboard not found", func(t *testing.T) {
		setup()
		_, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc1234",
				DashboardUid: "nevergonnafindme",
				OrgId:        savedDashboard.OrgId,
			},
		})
		require.NoError(t, err)
		_, _, err = dashboardStore.GetPublicDashboard("abc1234")
		require.Error(t, models.ErrDashboardNotFound, err)
	})
}

// GetPublicDashboardConfig
func TestIntegrationGetPublicDashboardConfig(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *DashboardStore
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		dashboardStore = ProvideDashboardStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("returns isPublic and set dashboardUid and orgId", func(t *testing.T) {
		setup()
		pubdash, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, &models.PublicDashboard{IsEnabled: false, DashboardUid: savedDashboard.Uid, OrgId: savedDashboard.OrgId}, pubdash)
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
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: simplejson.NewFromAny(map[string]interface{}{"from": "now-8", "to": "now"}),
			},
		})
		require.NoError(t, err)

		pubdash, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, resp, pubdash)
	})
}

// SavePublicDashboardConfig
func TestIntegrationSavePublicDashboardConfig(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *DashboardStore
	var savedDashboard *models.Dashboard
	var savedDashboard2 *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		dashboardStore = ProvideDashboardStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
		savedDashboard2 = insertTestDashboard(t, dashboardStore, "testDashie2", 1, 0, true)
	}

	t.Run("saves new public dashboard", func(t *testing.T) {
		setup()
		resp, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: TimeSettings,
			},
		})
		require.NoError(t, err)

		pubdash, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		//verify saved response and queried response are the same
		assert.Equal(t, resp, pubdash)

		// verify we have a valid uid
		assert.True(t, util.IsValidShortUID(pubdash.Uid))

		// verify we didn't update all dashboards
		pubdash2, err := dashboardStore.GetPublicDashboardConfig(savedDashboard2.OrgId, savedDashboard2.Uid)
		require.NoError(t, err)
		assert.False(t, pubdash2.IsEnabled)
	})

	t.Run("returns ErrDashboardIdentifierNotSet", func(t *testing.T) {
		setup()
		_, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    true,
				DashboardUid: "",
				OrgId:        savedDashboard.OrgId,
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
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    true,
				Uid:          pdUid,
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
			},
		})
		require.NoError(t, err)

		// update initial record
		resp, err := dashboardStore.SavePublicDashboardConfig(models.SavePublicDashboardConfigCommand{
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			PublicDashboard: models.PublicDashboard{
				IsEnabled:    false,
				Uid:          pdUid,
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: simplejson.NewFromAny(map[string]interface{}{"from": "now-8", "to": "now"}),
			},
		})
		require.NoError(t, err)

		pubdash, err := dashboardStore.GetPublicDashboardConfig(savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, resp, pubdash)
	})
}
