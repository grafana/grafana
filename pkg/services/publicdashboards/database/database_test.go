package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsDB "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

// This is what the db sets empty time settings to
var DefaultTimeSettings = &TimeSettings{}

// Default time to pass in with seconds rounded
var DefaultTime = time.Now().UTC().Round(time.Second)

// run tests with cleanup
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestLogPrefix(t *testing.T) {
	assert.Equal(t, LogPrefix, "publicdashboards.store")
}

func TestIntegrationListPublicDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider

	var aDash *dashboards.Dashboard
	var bDash *dashboards.Dashboard
	var cDash *dashboards.Dashboard

	var aPublicDash *PublicDashboard
	var bPublicDash *PublicDashboard
	var cPublicDash *PublicDashboard

	var orgId int64 = 1

	var publicdashboardStore *PublicDashboardStoreImpl

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t, db.InitTestDBOpt{})
		dashboardStore, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())

		bDash = insertTestDashboard(t, dashboardStore, "b", orgId, "", false)
		aDash = insertTestDashboard(t, dashboardStore, "a", orgId, "", false)
		cDash = insertTestDashboard(t, dashboardStore, "c", orgId, "", false)

		// these are in order of how they should be returned from ListPUblicDashboards
		aPublicDash = insertPublicDashboard(t, publicdashboardStore, aDash.UID, orgId, false, PublicShareType)
		bPublicDash = insertPublicDashboard(t, publicdashboardStore, bDash.UID, orgId, true, PublicShareType)
		cPublicDash = insertPublicDashboard(t, publicdashboardStore, cDash.UID, orgId, true, PublicShareType)
	}

	t.Run("FindAll will return dashboard list based on orgId with pagination", func(t *testing.T) {
		setup()

		// should not be included in response
		_ = insertPublicDashboard(t, publicdashboardStore, "wrongOrgId", 777, false, PublicShareType)

		permissions := []accesscontrol.Permission{
			{Action: dashboards.ActionDashboardsRead, Scope: fmt.Sprintf("dashboards:uid:%s", aDash.UID)},
			{Action: dashboards.ActionDashboardsRead, Scope: fmt.Sprintf("dashboards:uid:%s", bDash.UID)},
			{Action: dashboards.ActionDashboardsRead, Scope: fmt.Sprintf("dashboards:uid:%s", cDash.UID)},
		}

		usr := &user.SignedInUser{UserID: 1, OrgID: orgId, Permissions: map[int64]map[string][]string{orgId: accesscontrol.GroupScopesByActionContext(context.Background(), permissions)}}

		actest.AddUserPermissionToDB(t, sqlStore, usr)

		query := &PublicDashboardListQuery{
			User:   usr,
			OrgID:  orgId,
			Page:   1,
			Limit:  50,
			Offset: 0,
		}
		resp, err := publicdashboardStore.FindAll(context.Background(), query)
		require.NoError(t, err)

		assert.Len(t, resp.PublicDashboards, 3)
		uids := make([]string, len(resp.PublicDashboards))
		for i, pubdash := range resp.PublicDashboards {
			uids[i] = pubdash.Uid
		}
		assert.Contains(t, uids, aPublicDash.Uid)
		assert.Contains(t, uids, bPublicDash.Uid)
		assert.Contains(t, uids, cPublicDash.Uid)
		assert.Equal(t, resp.TotalCount, int64(3))
	})
}

func TestIntegrationExistsEnabledByAccessToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
	}
	t.Run("ExistsEnabledByAccessToken will return true when at least one public dashboard has a matching access token", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc123",
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
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
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
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
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
	}

	t.Run("ExistsEnabledByDashboardUid Will return true when dashboard has at least one enabled public dashboard", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc123",
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		require.NoError(t, err)

		res, err := publicdashboardStore.ExistsEnabledByDashboardUid(context.Background(), savedDashboard.UID)
		require.NoError(t, err)

		require.True(t, res)
	})

	t.Run("ExistsEnabledByDashboardUid will return false when dashboard has public dashboards but they are not enabled", func(t *testing.T) {
		setup()

		_, err := publicdashboardStore.Create(context.Background(), SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    false,
				Uid:          "abc123",
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "NOTAREALUUID",
			},
		})
		require.NoError(t, err)

		res, err := publicdashboardStore.ExistsEnabledByDashboardUid(context.Background(), savedDashboard.UID)
		require.NoError(t, err)

		require.False(t, res)
	})
}

func TestIntegrationFindByDashboardUid(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
	}

	t.Run("returns public dashboard by dashboardUid", func(t *testing.T) {
		setup()
		savedPubdash := insertPublicDashboard(t, publicdashboardStore, savedDashboard.UID, savedDashboard.OrgID, false, PublicShareType)
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, savedDashboard.UID)
		require.NoError(t, err)
		assert.Equal(t, savedPubdash, pubdash)
	})

	t.Run("returns nil when identifier is not set", func(t *testing.T) {
		setup()
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, "")
		assert.Nil(t, err)
		assert.Nil(t, pubdash)
	})

	t.Run("returns along with public dashboard when exists", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "pubdash-uid",
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
				TimeSettings: DefaultTimeSettings,
				CreatedAt:    DefaultTime,
				CreatedBy:    7,
			},
		}

		// insert test public dashboard
		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		// retrieve from db
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, savedDashboard.UID)
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
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	var err error

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
	}

	t.Run("returns public dashboard by accessToken", func(t *testing.T) {
		setup()
		savedPubdash := insertPublicDashboard(t, publicdashboardStore, savedDashboard.UID, savedDashboard.OrgID, false, PublicShareType)
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
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
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
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	var savedDashboard2 *dashboards.Dashboard

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t, db.InitTestDBOpt{})
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
		savedDashboard2 = insertTestDashboard(t, dashboardStore, "testDashie2", 1, "", true)
		insertPublicDashboard(t, publicdashboardStore, savedDashboard2.UID, savedDashboard2.OrgID, false, PublicShareType)
	}

	t.Run("saves new public dashboard", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:            true,
				AnnotationsEnabled:   true,
				TimeSelectionEnabled: true,
				Share:                PublicShareType,
				Uid:                  "pubdash-uid",
				DashboardUid:         savedDashboard.UID,
				OrgId:                savedDashboard.OrgID,
				TimeSettings:         DefaultTimeSettings,
				CreatedAt:            DefaultTime,
				CreatedBy:            7,
				AccessToken:          "NOTAREALUUID",
			},
		}
		affectedRows, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, savedDashboard.UID)
		require.NoError(t, err)
		assert.Equal(t, cmd.PublicDashboard.AccessToken, pubdash.AccessToken)
		assert.True(t, pubdash.IsEnabled)
		assert.True(t, pubdash.AnnotationsEnabled)
		assert.True(t, pubdash.TimeSelectionEnabled)
		assert.Equal(t, cmd.PublicDashboard.Share, pubdash.Share)

		// verify we didn't update all dashboards
		pubdash2, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard2.OrgID, savedDashboard2.UID)
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
				OrgId:        savedDashboard.OrgID,
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
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	var anotherSavedDashboard *dashboards.Dashboard
	var err error

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t, db.InitTestDBOpt{})
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
		anotherSavedDashboard = insertTestDashboard(t, dashboardStore, "test another Dashie", 1, "", true)
	}

	t.Run("updates an existing dashboard", func(t *testing.T) {
		setup()

		pdUid := "asdf1234"
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				Uid:                  pdUid,
				DashboardUid:         savedDashboard.UID,
				OrgId:                savedDashboard.OrgID,
				IsEnabled:            false,
				AnnotationsEnabled:   true,
				TimeSelectionEnabled: true,
				CreatedAt:            DefaultTime,
				CreatedBy:            7,
				AccessToken:          "NOTAREALUUID",
			},
		}
		affectedRows, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		// inserting two different public dashboards to test update works and only affect the desired pd by uid
		anotherPdUid := "anotherUid"
		cmd = SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				Uid:                  anotherPdUid,
				DashboardUid:         anotherSavedDashboard.UID,
				OrgId:                anotherSavedDashboard.OrgID,
				IsEnabled:            true,
				AnnotationsEnabled:   false,
				TimeSelectionEnabled: false,
				Share:                PublicShareType,
				CreatedAt:            DefaultTime,
				CreatedBy:            7,
				AccessToken:          "fakeaccesstoken",
			},
		}

		affectedRows, err = publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		updatedPublicDashboard := PublicDashboard{
			Uid:                  pdUid,
			DashboardUid:         savedDashboard.UID,
			OrgId:                savedDashboard.OrgID,
			IsEnabled:            false,
			AnnotationsEnabled:   true,
			TimeSelectionEnabled: true,
			Share:                EmailShareType,
			TimeSettings:         &TimeSettings{From: "now-8", To: "now"},
			UpdatedAt:            time.Now().UTC().Round(time.Second),
			UpdatedBy:            8,
		}

		// update initial record
		cmd = SavePublicDashboardCommand{PublicDashboard: updatedPublicDashboard}
		rowsAffected, err := publicdashboardStore.Update(context.Background(), cmd)
		require.NoError(t, err)
		assert.EqualValues(t, rowsAffected, 1)

		// updated dashboard should have changed
		pdRetrieved, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, savedDashboard.UID)
		require.NoError(t, err)

		assert.Equal(t, updatedPublicDashboard.UpdatedAt, pdRetrieved.UpdatedAt)
		// make sure we're correctly updated ExistsEnabledByDashboardUid because we have to call
		// UseBool with xorm
		assert.Equal(t, updatedPublicDashboard.IsEnabled, pdRetrieved.IsEnabled)
		assert.Equal(t, updatedPublicDashboard.AnnotationsEnabled, pdRetrieved.AnnotationsEnabled)
		assert.Equal(t, updatedPublicDashboard.TimeSelectionEnabled, pdRetrieved.TimeSelectionEnabled)
		assert.Equal(t, updatedPublicDashboard.Share, pdRetrieved.Share)

		// not updated dashboard shouldn't have changed
		pdNotUpdatedRetrieved, err := publicdashboardStore.FindByDashboardUid(context.Background(), anotherSavedDashboard.OrgID, anotherSavedDashboard.UID)
		require.NoError(t, err)
		assert.NotEqual(t, updatedPublicDashboard.UpdatedAt, pdNotUpdatedRetrieved.UpdatedAt)
		assert.NotEqual(t, updatedPublicDashboard.IsEnabled, pdNotUpdatedRetrieved.IsEnabled)
		assert.NotEqual(t, updatedPublicDashboard.AnnotationsEnabled, pdNotUpdatedRetrieved.AnnotationsEnabled)
		assert.NotEqual(t, updatedPublicDashboard.Share, pdNotUpdatedRetrieved.Share)
	})
}

func TestIntegrationGetOrgIdByAccessToken(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	var err error

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
	}
	t.Run("GetOrgIdByAccessToken will OrgId when enabled", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    true,
				Uid:          "abc123",
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "accessToken",
			},
		}
		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		orgId, err := publicdashboardStore.GetOrgIdByAccessToken(context.Background(), "accessToken")
		require.NoError(t, err)

		assert.Equal(t, savedDashboard.OrgID, orgId)
	})

	t.Run("GetOrgIdByAccessToken will return current OrgId when IsEnabled=false", func(t *testing.T) {
		setup()
		cmd := SavePublicDashboardCommand{
			PublicDashboard: PublicDashboard{
				IsEnabled:    false,
				Uid:          "abc123",
				DashboardUid: savedDashboard.UID,
				OrgId:        savedDashboard.OrgID,
				CreatedAt:    time.Now(),
				CreatedBy:    7,
				AccessToken:  "accessToken",
			},
		}

		_, err := publicdashboardStore.Create(context.Background(), cmd)
		require.NoError(t, err)

		orgId, err := publicdashboardStore.GetOrgIdByAccessToken(context.Background(), "accessToken")
		require.NoError(t, err)
		assert.Equal(t, savedDashboard.OrgID, orgId)
	})

	t.Run("GetOrgIdByAccessToken will return 0 when no public dashboard has matching access token", func(t *testing.T) {
		setup()

		orgId, err := publicdashboardStore.GetOrgIdByAccessToken(context.Background(), "nonExistentAccessToken")
		require.NoError(t, err)
		assert.NotEqual(t, savedDashboard.OrgID, orgId)
	})
}

func TestIntegrationDelete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	var savedPublicDashboard *PublicDashboard
	var err error

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
		savedPublicDashboard = insertPublicDashboard(t, publicdashboardStore, savedDashboard.UID, savedDashboard.OrgID, true, PublicShareType)
	}

	t.Run("Delete success", func(t *testing.T) {
		setup()
		// Do the deletion
		affectedRows, err := publicdashboardStore.Delete(context.Background(), savedPublicDashboard.Uid)
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 1)

		// Verify public dashboard is actually deleted
		deletedDashboard, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedPublicDashboard.OrgId, savedPublicDashboard.DashboardUid)
		require.NoError(t, err)
		require.Nil(t, deletedDashboard)
	})

	t.Run("Non-existent public dashboard deletion doesn't throw an error", func(t *testing.T) {
		setup()

		affectedRows, err := publicdashboardStore.Delete(context.Background(), "non-existent-uid")
		require.NoError(t, err)
		assert.EqualValues(t, affectedRows, 0)
	})
}

func TestIntegrationDeleteByDashboardUIDs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	// var savedPublicDashboard *PublicDashboard
	var err error

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t)
		dashboardStore, err = dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", true)
		_ = insertPublicDashboard(t, publicdashboardStore, savedDashboard.UID, savedDashboard.OrgID, true, PublicShareType)
	}

	t.Run("returns nil when dashboardUIDs is empty", func(t *testing.T) {
		setup()
		var dashboardUIDs []string
		store := ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		err := store.DeleteByDashboardUIDs(context.Background(), 1, dashboardUIDs)

		require.NoError(t, err)
		assert.Nil(t, err)
	})

	t.Run("deletes public dashboards with provided dashboard uids", func(t *testing.T) {
		setup()

		// confirm the pubdash exists
		pubdash, err := publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, savedDashboard.UID)
		require.NoError(t, err)
		assert.NotNil(t, pubdash)

		dashboardUIDs := []string{savedDashboard.UID}

		// delete the pubdash by dashboard uid
		err = publicdashboardStore.DeleteByDashboardUIDs(context.Background(), 1, dashboardUIDs)
		require.NoError(t, err)
		assert.Nil(t, err)

		// confirm the pubdash was deleted
		pubdash, err = publicdashboardStore.FindByDashboardUid(context.Background(), savedDashboard.OrgID, savedDashboard.UID)
		require.NoError(t, err)
		assert.Nil(t, pubdash)
	})
}

func TestIntegrationGetMetrics(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var settingsProvider setting.SettingsProvider
	var dashboardStore dashboards.Store
	var publicdashboardStore *PublicDashboardStoreImpl
	var savedDashboard *dashboards.Dashboard
	var savedDashboard2 *dashboards.Dashboard
	var savedDashboard3 *dashboards.Dashboard
	var savedDashboard4 *dashboards.Dashboard

	setup := func() {
		sqlStore, settingsProvider = db.InitTestDBWithCfg(t, db.InitTestDBOpt{})
		store, err := dashboardsDB.ProvideDashboardStore(sqlStore, settingsProvider, featuremgmt.WithFeatures(), tagimpl.ProvideService(sqlStore))
		require.NoError(t, err)
		dashboardStore = store
		publicdashboardStore = ProvideStore(sqlStore, settingsProvider, featuremgmt.WithFeatures())
		savedDashboard = insertTestDashboard(t, dashboardStore, "testDashie", 1, "", false)
		savedDashboard2 = insertTestDashboard(t, dashboardStore, "testDashie2", 1, "", false)
		savedDashboard3 = insertTestDashboard(t, dashboardStore, "testDashie3", 2, "", false)
		savedDashboard4 = insertTestDashboard(t, dashboardStore, "testDashie4", 2, "", false)
		insertPublicDashboard(t, publicdashboardStore, savedDashboard.UID, savedDashboard.OrgID, true, PublicShareType)
		insertPublicDashboard(t, publicdashboardStore, savedDashboard2.UID, savedDashboard2.OrgID, true, PublicShareType)
		insertPublicDashboard(t, publicdashboardStore, savedDashboard3.UID, savedDashboard3.OrgID, true, EmailShareType)
		insertPublicDashboard(t, publicdashboardStore, savedDashboard4.UID, savedDashboard4.OrgID, false, EmailShareType)
	}

	t.Run("returns correct list of metrics", func(t *testing.T) {
		setup()

		metrics, err := publicdashboardStore.GetMetrics(context.Background())
		require.NoError(t, err)

		assert.Equal(t, 3, len(metrics.TotalPublicDashboards))
		enabledAndPublicCount := -1
		enabledAndEmailCount := -1
		disabledAndEmailCount := -1
		disabledAndPublicCount := -1
		for _, metric := range metrics.TotalPublicDashboards {
			if metric.ShareType == string(PublicShareType) && metric.IsEnabled {
				enabledAndPublicCount = int(metric.TotalCount)
			}
			if metric.ShareType == string(PublicShareType) && !metric.IsEnabled {
				disabledAndPublicCount = int(metric.TotalCount)
			}
			if metric.ShareType == string(EmailShareType) && metric.IsEnabled {
				enabledAndEmailCount = int(metric.TotalCount)
			}
			if metric.ShareType == string(EmailShareType) && !metric.IsEnabled {
				disabledAndEmailCount = int(metric.TotalCount)
			}
		}

		assert.Equal(t, 2, enabledAndPublicCount)
		assert.Equal(t, 1, enabledAndEmailCount)
		assert.Equal(t, 1, disabledAndEmailCount)
		assert.Equal(t, -1, disabledAndPublicCount)
	})
}

// helper function to insert a dashboard
func insertTestDashboard(t *testing.T, dashboardStore dashboards.Store, title string, orgID int64,
	folderUID string, isFolder bool, tags ...any,
) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgID,
		FolderUID: folderUID,
		IsFolder:  isFolder,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.ID)
	dash.Data.Set("uid", dash.UID)
	return dash
}

// helper function to insert a public dashboard
func insertPublicDashboard(t *testing.T, publicdashboardStore *PublicDashboardStoreImpl, dashboardUid string, orgId int64, isEnabled bool, shareType ShareType) *PublicDashboard {
	ctx := context.Background()

	uid := util.GenerateShortUID()

	accessToken, err := service.GenerateAccessToken()
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
			Share:        shareType,
		},
	}

	affectedRows, err := publicdashboardStore.Create(ctx, cmd)
	require.NoError(t, err)
	assert.EqualValues(t, affectedRows, 1)

	pubdash, err := publicdashboardStore.Find(ctx, uid)
	require.NoError(t, err)

	return pubdash
}
