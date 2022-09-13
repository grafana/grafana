package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

// This is what the db sets empty time settings to
var DefaultTimeSettings = &TimeSettings{}

// Default time to pass in with seconds rounded
var DefaultTime = time.Now().UTC().Round(time.Second)

func TestLogPrefix(t *testing.T) {
	assert.Equal(t, LogPrefix, "publicdashboards.store")
}

func TestIntegrationGetDashboard(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		dashboardStore = dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("GetDashboard can get original dashboard by uid", func(t *testing.T) {
		setup()

		dashboard, err := publicdashboardStore.GetDashboard(context.Background(), savedDashboard.Uid)

		require.NoError(t, err)
		require.Equal(t, savedDashboard.Uid, dashboard.Uid)
	})
}

// GetPublicDashboard
func TestIntegrationGetPublicDashboard(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		dashboardStore = dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}
	t.Run("AccessTokenExists will return true when at least one public dashboard has a matching access token", func(t *testing.T) {
		setup()

		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc123",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "accessToken",
			},
		})
		require.NoError(t, err)

		res, err := publicdashboardStore.AccessTokenExists(context.Background(), "accessToken")
		require.NoError(t, err)

		require.True(t, res)
	})

	t.Run("AccessTokenExists will return false when no public dashboard has matching access token", func(t *testing.T) {
		setup()

		res, err := publicdashboardStore.AccessTokenExists(context.Background(), "accessToken")

		require.NoError(t, err)
		require.False(t, res)
	})

	t.Run("PublicDashboardEnabled Will return true when dashboard has at least one enabled public dashboard", func(t *testing.T) {
		setup()

		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc123",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		require.NoError(t, err)

		res, err := publicdashboardStore.PublicDashboardEnabled(context.Background(), savedDashboard.Uid)
		require.NoError(t, err)

		require.True(t, res)
	})

	t.Run("PublicDashboardEnabled will return false when dashboard has public dashboards but they are not enabled", func(t *testing.T) {
		setup()

		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    false,
				Uid:          "abc123",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		require.NoError(t, err)

		res, err := publicdashboardStore.PublicDashboardEnabled(context.Background(), savedDashboard.Uid)
		require.NoError(t, err)

		require.False(t, res)
	})

	t.Run("returns PublicDashboard and Dashboard", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc1234",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: DefaultTimeSettings,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		}

		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), cmd)
		require.NoError(t, err)

		pd, d, err := publicdashboardStore.GetPublicDashboard(context.Background(), "NOTAREALUUID")
		require.NoError(t, err)

		assert.Equal(t, pd, &cmd.PublicDashboard)
		assert.Equal(t, d.Uid, cmd.PublicDashboard.DashboardUid)
	})

	t.Run("returns ErrPublicDashboardNotFound with empty uid", func(t *testing.T) {
		setup()
		_, _, err := publicdashboardStore.GetPublicDashboard(context.Background(), "")
		require.Error(t, ErrPublicDashboardIdentifierNotSet, err)
	})

	t.Run("returns ErrPublicDashboardNotFound when PublicDashboard not found", func(t *testing.T) {
		setup()
		_, _, err := publicdashboardStore.GetPublicDashboard(context.Background(), "zzzzzz")
		require.Error(t, ErrPublicDashboardNotFound, err)
	})

	t.Run("returns ErrDashboardNotFound when Dashboard not found", func(t *testing.T) {
		setup()
		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc1234",
				DashboardUid: "nevergonnafindme",
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
			},
		})
		require.NoError(t, err)
		_, _, err = publicdashboardStore.GetPublicDashboard(context.Background(), "abc1234")
		require.Error(t, dashboards.ErrDashboardNotFound, err)
	})
}

// GetPublicDashboardConfig
func TestIntegrationGetPublicDashboardConfig(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		dashboardStore = dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("returns isPublic and set dashboardUid and orgId", func(t *testing.T) {
		setup()
		pubdash, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, &PublicDashboard{IsEnabled: false, DashboardUid: savedDashboard.Uid, OrgId: savedDashboard.OrgId}, pubdash)
	})

	t.Run("returns dashboard errDashboardIdentifierNotSet", func(t *testing.T) {
		setup()
		_, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), savedDashboard.OrgId, "")
		require.Error(t, dashboards.ErrDashboardIdentifierNotSet, err)
	})

	t.Run("returns along with public dashboard when exists", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: DefaultTimeSettings,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
			},
		}

		// insert test public dashboard
		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), cmd)
		require.NoError(t, err)

		// retrieve from db
		pubdash, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		assert.True(t, assert.ObjectsAreEqualValues(&cmd.PublicDashboard, pubdash))
	})
}

// SavePublicDashboardConfig
func TestIntegrationSavePublicDashboardConfig(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var savedDashboard2 *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		dashboardStore = dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
		savedDashboard2 = insertTestDashboard(t, dashboardStore, "testDashie2", 1, 0, true)
	}

	t.Run("saves new public dashboard", func(t *testing.T) {
		setup()
		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: DefaultTimeSettings,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		require.NoError(t, err)

		pubdash, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		// verify we have a valid uid
		assert.True(t, util.IsValidShortUID(pubdash.Uid))

		// verify we didn't update all dashboards
		pubdash2, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), savedDashboard2.OrgId, savedDashboard2.Uid)
		require.NoError(t, err)
		assert.False(t, pubdash2.IsEnabled)
	})

	t.Run("guards from saving without dashboardUid", func(t *testing.T) {
		setup()
		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: "",
				OrgId:        savedDashboard.OrgId,
				TimeSettings: DefaultTimeSettings,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		assert.Error(t, err, dashboards.ErrDashboardIdentifierNotSet)
	})
}

func TestIntegrationUpdatePublicDashboard(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var anotherSavedDashboard *models.Dashboard

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		dashboardStore = dashboardsDB.ProvideDashboardStore(sqlStore, featuremgmt.WithFeatures())
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
		anotherSavedDashboard = insertTestDashboard(t, dashboardStore, "test another Dashie", 1, 0, true)
	}

	t.Run("updates an existing dashboard", func(t *testing.T) {
		setup()

		pdUid := "asdf1234"
		err := publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				Uid:          pdUid,
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				IsEnabled:    true,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		require.NoError(t, err)

		// inserting two different public dashboards to test update works and only affect the desired pd by uid
		anotherPdUid := "anotherUid"
		err = publicdashboardStore.SavePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: PublicDashboard{
				Uid:          anotherPdUid,
				DashboardUid: anotherSavedDashboard.Uid,
				OrgId:        anotherSavedDashboard.OrgId,
				IsEnabled:    true,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
				AccessToken:  "fakeaccesstoken",
			},
		})
		require.NoError(t, err)

		updatedPublicDashboard := PublicDashboard{
			Uid:          pdUid,
			DashboardUid: savedDashboard.Uid,
			OrgId:        savedDashboard.OrgId,
			IsEnabled:    false,
			TimeSettings: &TimeSettings{From: "now-8", To: "now"},
			UpdatedAt:    time.Now().UTC().Round(time.Second),
			UpdatedBy:    8,
		}
		// update initial record
		err = publicdashboardStore.UpdatePublicDashboardConfig(context.Background(), SavePublicDashboardConfigCommand{
			PublicDashboard: updatedPublicDashboard,
		})
		require.NoError(t, err)

		// updated dashboard should have changed
		pdRetrieved, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		assert.Equal(t, updatedPublicDashboard.UpdatedAt, pdRetrieved.UpdatedAt)
		// make sure we're correctly updated IsEnabled because we have to call
		// UseBool with xorm
		assert.Equal(t, updatedPublicDashboard.IsEnabled, pdRetrieved.IsEnabled)

		// not updated dashboard shouldn't have changed
		pdNotUpdatedRetrieved, err := publicdashboardStore.GetPublicDashboardConfig(context.Background(), anotherSavedDashboard.OrgId, anotherSavedDashboard.Uid)
		require.NoError(t, err)
		assert.NotEqual(t, updatedPublicDashboard.UpdatedAt, pdNotUpdatedRetrieved.UpdatedAt)
		assert.NotEqual(t, updatedPublicDashboard.IsEnabled, pdNotUpdatedRetrieved.IsEnabled)
	})
}

func insertTestDashboard(t *testing.T, dashboardStore *dashboardsDB.DashboardStore, title string, orgId int64,
	folderId int64, isFolder bool, tags ...interface{}) *models.Dashboard {
	t.Helper()
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}
	dash, err := dashboardStore.SaveDashboard(cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.Id)
	dash.Data.Set("uid", dash.Uid)
	return dash
}
