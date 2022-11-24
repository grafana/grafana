package database

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/tokens"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// This is what the db sets empty time settings to
var DefaultTimeSettings = &TimeSettings{}

// Default time to pass in with seconds rounded
var DefaultTime = time.Now().UTC().Round(time.Second)

func TestLogPrefix(t *testing.T) {
	assert.Equal(t, LogPrefix, "publicdashboards.store")
}

func TestIntegrationListPublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore, cfg := db.InitTestDBwithCfg(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
	require.NoError(t, err)
	publicdashboardStore := ProvideStore(sqlStore)

	var orgId int64 = 1

	aDash := insertTestDashboard(t, dashboardStore, "a", orgId, 0, true)
	bDash := insertTestDashboard(t, dashboardStore, "b", orgId, 0, true)
	cDash := insertTestDashboard(t, dashboardStore, "c", orgId, 0, true)

	// these are in order of how they should be returned from ListPUblicDashboards
	a := insertPublicDashboard(t, publicdashboardStore, bDash.Uid, orgId, true)
	b := insertPublicDashboard(t, publicdashboardStore, cDash.Uid, orgId, true)
	c := insertPublicDashboard(t, publicdashboardStore, aDash.Uid, orgId, false)

	// this is case that can happen as of now, however, postgres and mysql sort
	// null in the exact opposite fashion and there is no shared syntax to sort
	// nulls in the same way in all 3 db's.
	//d := insertPublicDashboard(t, publicdashboardStore, "missing", orgId, false)

	// should not be included in response
	_ = insertPublicDashboard(t, publicdashboardStore, "wrongOrgId", 777, false)

	resp, err := publicdashboardStore.FindAll(context.Background(), orgId)
	require.NoError(t, err)

	assert.Len(t, resp, 3)
	assert.Equal(t, resp[0].Uid, a.Uid)
	assert.Equal(t, resp[1].Uid, b.Uid)
	assert.Equal(t, resp[2].Uid, c.Uid)
}

func TestIntegrationFindDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("FindDashboard can get original dashboard by uid", func(t *testing.T) {
		setup()

		dashboard, err := publicdashboardStore.FindDashboard(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)

		require.NoError(t, err)
		require.Equal(t, savedDashboard.Uid, dashboard.Uid)
	})
}

func TestIntegrationExistsEnabledByAccessToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}
	t.Run("ExistsEnabledByAccessToken will return true when at least one public dashboard has a matching access token", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
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

		res, err := publicdashboardStore.ExistsEnabledByAccessToken(context.Background(), "accessToken")
		require.NoError(t, err)

		require.True(t, res)
	})

	t.Run("ExistsEnabledByAccessToken will return false when IsEnabled=false", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    false,
				Uid:          "abc123",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "accessToken",
			},
		})
		require.NoError(t, err)

		res, err := publicdashboardStore.ExistsEnabledByAccessToken(context.Background(), "accessToken")
		require.NoError(t, err)

		require.False(t, res)
	})

	t.Run("ExistsEnabledByAccessToken will return false when no public dashboard has matching access token", func(t *testing.T) {
		setup()

		res, err := publicdashboardStore.ExistsEnabledByAccessToken(context.Background(), "accessToken")

		require.NoError(t, err)
		require.False(t, res)
	})
}

func TestIntegrationExistsEnabledByDashboardUid(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("ExistsEnabledByDashboardUid Will return true when dashboard has at least one enabled public dashboard", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
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

		res, err := publicdashboardStore.ExistsEnabledByDashboardUid(context.Background(), savedDashboard.Uid)
		require.NoError(t, err)

		require.True(t, res)
	})

	t.Run("ExistsEnabledByDashboardUid will return false when dashboard has public dashboards but they are not enabled", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
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

		res, err := publicdashboardStore.ExistsEnabledByDashboardUid(context.Background(), savedDashboard.Uid)
		require.NoError(t, err)

		require.False(t, res)
	})
}

func TestIntegrationFindByDashboardUid(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("returns public dashboard by dashboardUid", func(t *testing.T) {
		setup()
		savedPubdash := insertPublicDashboard(t, publicdashboardStore, savedDashboard.Uid, savedDashboard.OrgId, false)
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, savedPubdash, pubdash)
	})

	t.Run("returns nil when identifier is not set", func(t *testing.T) {
		setup()
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgId, "")
		assert.Nil(t, err)
		assert.Nil(t, pubdash)
	})

	t.Run("returns along with public dashboard when exists", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
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
		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		// retrieve from db
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		assert.True(t, assert.ObjectsAreEqualValues(&cmd.PublicDashboard, pubdash))
	})

	t.Run("returns nil when public dashboard doesn't exist", func(t *testing.T) {
		setup()
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), 9, "fake-dashboard-uid")
		require.NoError(t, err)
		assert.Nil(t, pubdash)
	})
}

func TestIntegrationFindByAccessToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var err error

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotatest.New(false, nil))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}

	t.Run("returns public dashboard by accessToken", func(t *testing.T) {
		setup()
		savedPubdash := insertPublicDashboard(t, publicdashboardStore, savedDashboard.Uid, savedDashboard.OrgId, false)
		pubdash, err := publicdashboardStore.FindByAccessToken(context.Background(), savedPubdash.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, savedPubdash, pubdash)
	})

	t.Run("returns nil when identifier is not set", func(t *testing.T) {
		setup()
		pubdash, err := publicdashboardStore.FindByAccessToken(context.Background(), "")
		assert.Nil(t, err)
		assert.Nil(t, pubdash)
	})

	t.Run("returns along with public dashboard when exists", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				TimeSettings: DefaultTimeSettings,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
				AccessToken:  "thisisavalidaccesstoken",
			},
		}

		// insert test public dashboard
		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		// retrieve from db
		pubdash, err := publicdashboardStore.FindByAccessToken(context.Background(), cmd.PublicDashboard.AccessToken)
		require.NoError(t, err)

		assert.True(t, assert.ObjectsAreEqualValues(&cmd.PublicDashboard, pubdash))
	})

	t.Run("returns error when public dashboard doesn't exist", func(t *testing.T) {
		setup()
		pubdash, err := publicdashboardStore.FindByAccessToken(context.Background(), "fake-accessToken-uid")
		require.NoError(t, err)
		assert.Nil(t, pubdash)
	})
}

func TestIntegrationCreatePublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var savedDashboard2 *models.Dashboard

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		quotaService := quotatest.New(false, nil)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
		savedDashboard2 = insertTestDashboard(t, dashboardStore, "testDashie2", 1, 0, true)
		insertPublicDashboard(t, publicdashboardStore, savedDashboard2.Uid, savedDashboard2.OrgId, false)
	}

	t.Run("saves new public dashboard", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:              true,
				AnnotationsEnabled:     true,
				TimeRangePickerEnabled: true,
				Uid:                    "pubdash-uid",
				DashboardUid:           savedDashboard.Uid,
				OrgId:                  savedDashboard.OrgId,
				TimeSettings:           DefaultTimeSettings,
				CreatedAt:              DefaultTime,
				CreatedBy:              7,
				AccessToken:            "NOTAREALUUID",
			},
		}
		affectedRows, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)
		assert.Equal(t, pubdash.AccessToken, "NOTAREALUUID")
		assert.True(t, pubdash.IsEnabled)
		assert.True(t, pubdash.AnnotationsEnabled)
		assert.True(t, pubdash.TimeRangePickerEnabled)

		// verify we didn't update all dashboards
		pubdash2, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard2.OrgId, savedDashboard2.Uid)
		require.NoError(t, err)
		assert.False(t, pubdash2.IsEnabled)
	})

	t.Run("guards from saving without dashboardUid", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
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
		}
		affectedRows, err := publicdashboardStore.Create(context.Background(), cmd)
		require.Error(t, err)
		assert.Equal(t, err, dashboards.ErrDashboardIdentifierNotSet)
		assert.EqualValues(t, affectedRows, 0)
	})
}

func TestIntegrationUpdatePublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var anotherSavedDashboard *models.Dashboard
	var err error

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t, db.InitTestDBOpt{FeatureFlags: []string{featuremgmt.FlagPublicDashboards}})
		quotaService := quotatest.New(false, nil)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
		anotherSavedDashboard = insertTestDashboard(t, dashboardStore, "test another Dashie", 1, 0, true)
	}

	t.Run("updates an existing dashboard", func(t *testing.T) {
		setup()

		pdUid := "asdf1234"
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				Uid:                    pdUid,
				DashboardUid:           savedDashboard.Uid,
				OrgId:                  savedDashboard.OrgId,
				IsEnabled:              false,
				AnnotationsEnabled:     true,
				TimeRangePickerEnabled: true,
				CreatedAt:              DefaultTime,
				CreatedBy:              7,
				AccessToken:            "NOTAREALUUID",
			},
		}
		affectedRows, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		// inserting two different public dashboards to test update works and only affect the desired pd by uid
		anotherPdUid := "anotherUid"
		cmd = SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				Uid:                    anotherPdUid,
				DashboardUid:           anotherSavedDashboard.Uid,
				OrgId:                  anotherSavedDashboard.OrgId,
				IsEnabled:              true,
				AnnotationsEnabled:     false,
				TimeRangePickerEnabled: false,
				CreatedAt:              DefaultTime,
				CreatedBy:              7,
				AccessToken:            "fakeaccesstoken",
			},
		}

		affectedRows, err = publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		updatedPublicDashboard := PublicDashboard{
			Uid:                    pdUid,
			DashboardUid:           savedDashboard.Uid,
			OrgId:                  savedDashboard.OrgId,
			IsEnabled:              false,
			AnnotationsEnabled:     true,
			TimeRangePickerEnabled: true,
			TimeSettings:           &TimeSettings{From: "now-8", To: "now"},
			UpdatedAt:              time.Now().UTC().Round(time.Second),
			UpdatedBy:              8,
		}

		// update initial record
		cmd = SavePublicDashboardCommand{PublicDashboard: updatedPublicDashboard}
		rowsAffected, err := publicdashboardStore.Update(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, rowsAffected, 1)

		// updated dashboard should have changed
		pdRetrieved, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgId, savedDashboard.Uid)
		require.NoError(t, err)

		assert.Equal(t, updatedPublicDashboard.UpdatedAt, pdRetrieved.UpdatedAt)
		// make sure we're correctly updated ExistsEnabledByDashboardUid because we have to call
		// UseBool with xorm
		assert.Equal(t, updatedPublicDashboard.IsEnabled, pdRetrieved.IsEnabled)
		assert.Equal(t, updatedPublicDashboard.AnnotationsEnabled, pdRetrieved.AnnotationsEnabled)
		assert.Equal(t, updatedPublicDashboard.TimeRangePickerEnabled, pdRetrieved.TimeRangePickerEnabled)

		// not updated dashboard shouldn't have changed
		pdNotUpdatedRetrieved, err := publicdashboardStore.FindByDashboardUid(context.Background(), anotherSavedDashboard.OrgId, anotherSavedDashboard.Uid)
		require.NoError(t, err)
		assert.NotEqual(t, updatedPublicDashboard.UpdatedAt, pdNotUpdatedRetrieved.UpdatedAt)
		assert.NotEqual(t, updatedPublicDashboard.IsEnabled, pdNotUpdatedRetrieved.IsEnabled)
		assert.NotEqual(t, updatedPublicDashboard.AnnotationsEnabled, pdNotUpdatedRetrieved.AnnotationsEnabled)
	})
}

func TestIntegrationGetOrgIdByAccessToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var err error

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		quotaService := quotatest.New(false, nil)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotaService)
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
	}
	t.Run("GetOrgIdByAccessToken will OrgId when enabled", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc123",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "accessToken",
			},
		}
		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		orgId, err := publicdashboardStore.GetOrgIdByAccessToken(context.Background(), "accessToken")
		require.NoError(t, err)

		assert.Equal(t, savedDashboard.OrgId, orgId)
	})

	t.Run("GetOrgIdByAccessToken will return 0 when IsEnabled=false", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    false,
				Uid:          "abc123",
				DashboardUid: savedDashboard.Uid,
				OrgId:        savedDashboard.OrgId,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "accessToken",
			},
		}

		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		orgId, err := publicdashboardStore.GetOrgIdByAccessToken(context.Background(), "accessToken")
		require.NoError(t, err)
		assert.NotEqual(t, savedDashboard.OrgId, orgId)
	})

	t.Run("GetOrgIdByAccessToken will return 0 when no public dashboard has matching access token", func(t *testing.T) {
		setup()

		orgId, err := publicdashboardStore.GetOrgIdByAccessToken(context.Background(), "nonExistentAccessToken")
		require.NoError(t, err)
		assert.NotEqual(t, savedDashboard.OrgId, orgId)
	})
}

func TestIntegrationDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var dashboardStore *dashboardsDB.DashboardStore
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *models.Dashboard
	var savedPublicDashboard *PublicDashboard
	var err error

	setup := func() {
		sqlStore, cfg = db.InitTestDBwithCfg(t)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore, cfg), quotatest.New(false, nil))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore)
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, 0, true)
		savedPublicDashboard = insertPublicDashboard(t, publicdashboardStore, savedDashboard.Uid, savedDashboard.OrgId, true)
	}

	t.Run("Delete success", func(t *testing.T) {
		setup()
		// Do the deletion
		affectedRows, err := publicdashboardStore.Delete(context.Background(), savedPublicDashboard.OrgId, savedPublicDashboard.Uid)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		// Verify public dashboard is actually deleted
		deletedDashboard, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedPublicDashboard.OrgId, savedPublicDashboard.DashboardUid)
		require.NoError(t, err)
		require.Nil(t, deletedDashboard)
	})

	t.Run("Non-existent public dashboard deletion doesn't throw an error", func(t *testing.T) {
		setup()

		affectedRows, err := publicdashboardStore.Delete(context.Background(), 15, "non-existent-uid")
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 0)
	})
}

// helper function to insert a dashboard
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
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.Id)
	dash.Data.Set("uid", dash.Uid)
	return dash
}

// helper function to insert a public dashboard
func insertPublicDashboard(t *testing.T, publicdashboardStore *PublicDashboardStoreImpl, dashboardUid string, orgId int64, isEnabled bool) *PublicDashboard {
	ctx := context.Background()

	uid := util.GenerateShortUID()

	accessToken, err := tokens.GenerateAccessToken()
	require.NoError(t, err)

	cmd := SavePublicDashboardCommand{
		PublicDashboard: PublicDashboard{
			Uid:          uid,
			DashboardUid: dashboardUid,
			OrgId:        orgId,
			IsEnabled:    isEnabled,
			TimeSettings: &TimeSettings{},
			CreatedBy:    1,
			CreatedAt:    time.Now(),
			AccessToken:  accessToken,
		},
	}

	affectedRows, err := publicdashboardStore.Create(ctx, cmd)
	require.NoError(t, err)
	assert.EqualValues(t, affectedRows, 1)

	pubdash, err := publicdashboardStore.Find(ctx, uid)
	require.NoError(t, err)

	return pubdash
}
