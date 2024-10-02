package database

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol/testutil"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

// run tests with cleanup
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDashboardDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore db.DB
	var cfg *setting.Cfg
	var savedFolder, savedDash, savedDash2 *dashboards.Dashboard
	var dashboardStore dashboards.Store

	setup := func() {
		sqlStore, cfg = db.InitTestDBWithCfg(t)
		quotaService := quotatest.New(false, nil)
		var err error
		dashboardStore, err = ProvideDashboardStore(sqlStore, cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore), quotaService)
		require.NoError(t, err)
		// insertTestDashboard creates the following hierarchy:
		// 1 test dash folder
		//   test dash 23
		//   test dash 45
		// test dash 67
		savedFolder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, "", true, "prod", "webapp")
		savedDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, savedFolder.ID, savedFolder.UID, false, "prod", "webapp")
		insertTestDashboard(t, dashboardStore, "test dash 45", 1, savedFolder.ID, savedFolder.UID, false, "prod")
		savedDash2 = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, "", false, "prod")
		insertTestRule(t, sqlStore, savedFolder.OrgID, savedFolder.UID)
	}

	t.Run("Should return dashboard model", func(t *testing.T) {
		setup()
		require.Equal(t, savedDash.Title, "test dash 23")
		require.Equal(t, savedDash.Slug, "test-dash-23")
		require.NotEqual(t, savedDash.ID, 0)
		require.False(t, savedDash.IsFolder)
		require.NotEmpty(t, savedDash.FolderUID)
		require.Positive(t, len(savedDash.UID))

		require.Equal(t, savedFolder.Title, "1 test dash folder")
		require.Equal(t, savedFolder.Slug, "1-test-dash-folder")
		require.NotEqual(t, savedFolder.ID, 0)
		require.True(t, savedFolder.IsFolder)
		require.Empty(t, savedFolder.FolderUID)
		require.Positive(t, len(savedFolder.UID))
	})

	t.Run("Should be able to get dashboard by id", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			ID:    savedDash.ID,
			OrgID: 1,
		}

		queryResult, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, queryResult.Title, "test dash 23")
		require.Equal(t, queryResult.Slug, "test-dash-23")
		require.Equal(t, queryResult.ID, savedDash.ID)
		require.Equal(t, queryResult.UID, savedDash.UID)
		require.False(t, queryResult.IsFolder)
	})

	t.Run("Should not be able to get dashboard by title alone", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			Title: util.Pointer("test dash 23"),
			OrgID: 1,
		}

		_, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.ErrorIs(t, err, dashboards.ErrDashboardIdentifierNotSet)
	})

	t.Run("Should be able to get root dashboard by title", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			Title:     util.Pointer("test dash 67"),
			FolderUID: util.Pointer(""),
			OrgID:     1,
		}

		_, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.Error(t, err)
	})

	t.Run("Should be able to get dashboard by title and folderID", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			Title:    util.Pointer("test dash 23"),
			FolderID: &savedDash.ID,
			OrgID:    1,
		}

		_, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.Error(t, err)
	})

	t.Run("Should be able to get dashboard by title and folderUID", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			Title:     util.Pointer("test dash 23"),
			FolderUID: util.Pointer(savedFolder.UID),
			OrgID:     1,
		}
		queryResult, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, queryResult.Title, "test dash 23")
		require.Equal(t, queryResult.Slug, "test-dash-23")
		require.Equal(t, queryResult.ID, savedDash.ID)
		require.Equal(t, queryResult.UID, savedDash.UID)
		require.False(t, queryResult.IsFolder)
	})

	t.Run("Should be able to get dashboard by uid", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			UID:   savedDash.UID,
			OrgID: 1,
		}

		queryResult, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, queryResult.Title, "test dash 23")
		require.Equal(t, queryResult.Slug, "test-dash-23")
		require.Equal(t, queryResult.ID, savedDash.ID)
		require.Equal(t, queryResult.UID, savedDash.UID)
		require.False(t, queryResult.IsFolder)
	})

	t.Run("Should be able to get a dashboard UID by ID", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardRefByIDQuery{ID: savedDash.ID}
		queryResult, err := dashboardStore.GetDashboardUIDByID(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, queryResult.UID, savedDash.UID)
	})

	t.Run("Shouldn't be able to get a dashboard with just an OrgID", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			OrgID: 1,
		}

		_, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.Equal(t, err, dashboards.ErrDashboardIdentifierNotSet)
	})

	t.Run("Folder=0 should not be able to get a dashboard in a folder", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardQuery{
			Title:     util.Pointer("test dash 23"),
			FolderUID: util.Pointer(""),
			OrgID:     1,
		}

		_, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.Error(t, err, dashboards.ErrDashboardNotFound)
	})

	t.Run("Should be able to get dashboards by IDs & UIDs", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardsQuery{DashboardIDs: []int64{savedDash.ID, savedDash2.ID}}
		queryResult, err := dashboardStore.GetDashboards(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, len(queryResult), 2)

		query = dashboards.GetDashboardsQuery{DashboardUIDs: []string{savedDash.UID, savedDash2.UID}}
		queryResult, err = dashboardStore.GetDashboards(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, len(queryResult), 2)
	})

	t.Run("Should be able to delete dashboard", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, dashboardStore, "delete me", 1, 0, "", false, "delete this")

		err := dashboardStore.DeleteDashboard(context.Background(), &dashboards.DeleteDashboardCommand{
			ID:    dash.ID,
			OrgID: 1,
		})
		require.NoError(t, err)
	})

	t.Run("Should be able to create dashboard", func(t *testing.T) {
		setup()
		cmd := dashboards.SaveDashboardCommand{
			OrgID: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "folderId",
				"tags":  []interface{}{},
			}),
			UserID: 100,
		}
		dashboard, err := dashboardStore.SaveDashboard(context.Background(), cmd)
		require.NoError(t, err)
		require.EqualValues(t, dashboard.CreatedBy, 100)
		require.False(t, dashboard.Created.IsZero())
		require.EqualValues(t, dashboard.UpdatedBy, 100)
		require.False(t, dashboard.Updated.IsZero())
	})

	t.Run("Should be able to update dashboard by id and remove folderId", func(t *testing.T) {
		setup()
		cmd := dashboards.SaveDashboardCommand{
			OrgID: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    savedDash.ID,
				"title": "folderId",
				"tags":  []interface{}{},
			}),
			Overwrite: true,
			FolderUID: "2",
			UserID:    100,
		}
		dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
		require.NoError(t, err)
		require.EqualValues(t, dash.FolderUID, "2")

		cmd = dashboards.SaveDashboardCommand{
			OrgID: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    savedDash.ID,
				"title": "folderId",
				"tags":  []interface{}{},
			}),
			FolderUID: "",
			Overwrite: true,
			UserID:    100,
		}
		_, err = dashboardStore.SaveDashboard(context.Background(), cmd)
		require.NoError(t, err)

		query := dashboards.GetDashboardQuery{
			ID:    savedDash.ID,
			OrgID: 1,
		}

		queryResult, err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, queryResult.FolderUID, "")
		require.Equal(t, queryResult.CreatedBy, savedDash.CreatedBy)
		require.WithinDuration(t, queryResult.Created, savedDash.Created, 3*time.Second)
		require.Equal(t, queryResult.UpdatedBy, int64(100))
		require.False(t, queryResult.Updated.IsZero())
	})

	t.Run("Should be able to delete empty folder", func(t *testing.T) {
		setup()
		emptyFolder := insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, "", true, "prod", "webapp")

		deleteCmd := &dashboards.DeleteDashboardCommand{ID: emptyFolder.ID}
		err := dashboardStore.DeleteDashboard(context.Background(), deleteCmd)
		require.NoError(t, err)
	})

	t.Run("Should return error if no dashboard is found for update when dashboard id is greater than zero", func(t *testing.T) {
		cmd := dashboards.SaveDashboardCommand{
			OrgID:     1,
			Overwrite: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    float64(123412321),
				"title": "Expect error",
				"tags":  []interface{}{},
			}),
		}

		_, err := dashboardStore.SaveDashboard(context.Background(), cmd)
		require.Equal(t, err, dashboards.ErrDashboardNotFound)
	})

	t.Run("Should not return error if no dashboard is found for update when dashboard id is zero", func(t *testing.T) {
		cmd := dashboards.SaveDashboardCommand{
			OrgID:     1,
			Overwrite: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    0,
				"title": "New dash",
				"tags":  []interface{}{},
			}),
		}
		_, err := dashboardStore.SaveDashboard(context.Background(), cmd)
		require.NoError(t, err)
	})

	t.Run("Should be able to get dashboard tags", func(t *testing.T) {
		setup()
		query := dashboards.GetDashboardTagsQuery{OrgID: 1}

		queryResult, err := dashboardStore.GetDashboardTags(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(queryResult), 2)
	})

	t.Run("Should be able to find dashboard folder", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			Title: "1 test dash folder",
			OrgId: 1,
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionFoldersRead: []string{dashboards.ScopeFoldersAll}},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 1)
		hit := hits[0]
		require.Equal(t, hit.Type, model.DashHitFolder)
		require.Equal(t, hit.URL, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.UID, savedFolder.Slug))
		require.Equal(t, hit.FolderTitle, "")
	})

	t.Run("Should be able to limit find results", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			OrgId: 1,
			Limit: 1,
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionFoldersRead: []string{dashboards.ScopeFoldersAll}},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 1)
		require.EqualValues(t, hits[0].Title, "1 test dash folder")
	})

	t.Run("Should be able to find results beyond limit using paging", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			OrgId: 1,
			Limit: 1,
			Page:  2,
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {
						dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll},
						dashboards.ActionFoldersRead:    []string{dashboards.ScopeFoldersAll},
					},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 1)
		require.EqualValues(t, hits[0].Title, "test dash 23")
	})

	t.Run("Should be able to filter by tag and type", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			OrgId: 1,
			Type:  "dash-db",
			Tags:  []string{"prod"},
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 3)
		require.Equal(t, hits[0].Title, "test dash 23")
	})

	t.Run("Should be able to find a dashboard folder's children", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			OrgId:      1,
			FolderUIDs: []string{savedFolder.UID},
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 2)
		hit := hits[0]
		require.Equal(t, hit.ID, savedDash.ID)
		require.Equal(t, hit.URL, fmt.Sprintf("/d/%s/%s", savedDash.UID, savedDash.Slug))
		require.Equal(t, hit.FolderUID, savedFolder.UID)
		require.Equal(t, hit.FolderTitle, savedFolder.Title)
		require.Equal(t, hit.FolderURL, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.UID, savedFolder.Slug))
	})

	t.Run("Should be able to find a dashboard folder's children by UID", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			OrgId:      1,
			FolderUIDs: []string{savedFolder.UID},
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 2)
		hit := hits[0]
		require.Equal(t, hit.ID, savedDash.ID)
		require.Equal(t, hit.URL, fmt.Sprintf("/d/%s/%s", savedDash.UID, savedDash.Slug))
		require.Equal(t, hit.FolderUID, savedFolder.UID)
		require.Equal(t, hit.FolderTitle, savedFolder.Title)
		require.Equal(t, hit.FolderURL, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.UID, savedFolder.Slug))
	})

	t.Run("Should be able to find dashboards by ids", func(t *testing.T) {
		setup()
		query := dashboards.FindPersistedDashboardsQuery{
			DashboardIds: []int64{savedDash.ID, savedDash2.ID},
			SignedInUser: &user.SignedInUser{
				OrgID:   1,
				OrgRole: org.RoleEditor,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		hits, err := testSearchDashboards(dashboardStore, &query)
		require.NoError(t, err)

		require.Equal(t, len(hits), 2)

		hit := hits[0]
		require.Equal(t, len(hit.Tags), 2)

		hit2 := hits[1]
		require.Equal(t, len(hit2.Tags), 1)
	})

	t.Run("Can count dashboards by parent folder", func(t *testing.T) {
		setup()
		// setup() saves one dashboard in the general folder and two in the "savedFolder".
		count, err := dashboardStore.CountDashboardsInFolders(
			context.Background(),
			&dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{""}, OrgID: 1})
		require.NoError(t, err)
		require.Equal(t, int64(1), count)

		count, err = dashboardStore.CountDashboardsInFolders(
			context.Background(),
			&dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{savedFolder.UID}, OrgID: 1})
		require.NoError(t, err)
		require.Equal(t, int64(2), count)
	})

	t.Run("Can delete dashboards in folder", func(t *testing.T) {
		setup()
		folder := insertTestDashboard(t, dashboardStore, "dash folder", 1, 0, "", true, "prod", "webapp")
		_ = insertTestDashboard(t, dashboardStore, "delete me 1", 1, folder.ID, folder.UID, false, "delete this 1")
		_ = insertTestDashboard(t, dashboardStore, "delete me 2", 1, folder.ID, folder.UID, false, "delete this 2")

		err := dashboardStore.SoftDeleteDashboardsInFolders(context.Background(), folder.OrgID, []string{folder.UID})
		require.NoError(t, err)

		count, err := dashboardStore.CountDashboardsInFolders(context.Background(), &dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{folder.UID}, OrgID: 1})
		require.NoError(t, err)
		require.Equal(t, count, int64(0))
	})
}

func TestIntegrationGetSoftDeletedDashboard(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	var sqlStore *sqlstore.SQLStore
	var cfg *setting.Cfg
	var savedFolder, savedDash *dashboards.Dashboard
	var dashboardStore dashboards.Store

	setup := func() {
		sqlStore, cfg = db.InitTestDBWithCfg(t)
		quotaService := quotatest.New(false, nil)
		var err error
		dashboardStore, err = ProvideDashboardStore(sqlStore, cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore), quotaService)
		require.NoError(t, err)
		savedFolder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, "", true, "prod", "webapp")
		savedDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, savedFolder.ID, savedFolder.UID, false, "prod", "webapp")
		insertTestDashboard(t, dashboardStore, "test dash 45", 1, savedFolder.ID, savedFolder.UID, false, "prod")
	}

	t.Run("Should soft delete a dashboard", func(t *testing.T) {
		setup()

		// Confirm there are 2 dashboards in the folder
		amount, err := dashboardStore.CountDashboardsInFolders(context.Background(), &dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{savedFolder.UID}, OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, int64(2), amount)

		// Soft delete the dashboard
		err = dashboardStore.SoftDeleteDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)

		// There is only 1 dashboard in the folder after soft delete
		amount, err = dashboardStore.CountDashboardsInFolders(context.Background(), &dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{savedFolder.UID}, OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, int64(1), amount)

		var dash *dashboards.Dashboard
		// Get the soft deleted dashboard should be empty
		dash, _ = dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: savedDash.UID, OrgID: savedDash.OrgID})
		assert.Error(t, dashboards.ErrDashboardNotFound)
		assert.Nil(t, dash)

		// Get the soft deleted dashboard
		dash, err = dashboardStore.GetSoftDeletedDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)
		assert.Equal(t, savedDash.ID, dash.ID)
		assert.Equal(t, savedDash.UID, dash.UID)
		assert.Equal(t, savedDash.Title, dash.Title)
	})

	t.Run("Should not fail when trying to soft delete a soft deleted dashboard", func(t *testing.T) {
		setup()

		// Soft delete the dashboard
		err := dashboardStore.SoftDeleteDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)

		// Soft delete the dashboard
		err = dashboardStore.SoftDeleteDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)

		// Get the soft deleted dashboard
		dash, err := dashboardStore.GetSoftDeletedDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)
		assert.Equal(t, savedDash.ID, dash.ID)
		assert.Equal(t, savedDash.UID, dash.UID)
		assert.Equal(t, savedDash.Title, dash.Title)
	})

	t.Run("Should restore a dashboard", func(t *testing.T) {
		setup()

		// Confirm there are 2 dashboards in the folder
		amount, err := dashboardStore.CountDashboardsInFolders(context.Background(), &dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{savedFolder.UID}, OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, int64(2), amount)

		// Soft delete the dashboard
		err = dashboardStore.SoftDeleteDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)

		// There is only 1 dashboard in the folder after soft delete
		amount, err = dashboardStore.CountDashboardsInFolders(context.Background(), &dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{savedFolder.UID}, OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, int64(1), amount)

		// Get the soft deleted dashboard
		dash, err := dashboardStore.GetSoftDeletedDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		require.NoError(t, err)
		assert.Equal(t, savedDash.ID, dash.ID)
		assert.Equal(t, savedDash.UID, dash.UID)
		assert.Equal(t, savedDash.Title, dash.Title)

		// Restore deleted dashboard
		// nolint:staticcheck
		err = dashboardStore.RestoreDashboard(context.Background(), savedDash.OrgID, savedDash.UID, &folder.Folder{ID: savedDash.FolderID, UID: savedDash.FolderUID})
		require.NoError(t, err)

		// Restore increases the amount of dashboards in the folder
		amount, err = dashboardStore.CountDashboardsInFolders(context.Background(), &dashboards.CountDashboardsInFolderRequest{FolderUIDs: []string{savedFolder.UID}, OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, int64(2), amount)

		// Get the soft deleted dashboard should be empty
		dash, err = dashboardStore.GetSoftDeletedDashboard(context.Background(), savedDash.OrgID, savedDash.UID)
		assert.Error(t, err)
		assert.Nil(t, dash)

		// Get the restored dashboard
		dash, err = dashboardStore.GetDashboard(context.Background(), &dashboards.GetDashboardQuery{UID: savedDash.UID, OrgID: savedDash.OrgID})
		require.NoError(t, err)
		assert.Equal(t, savedDash.ID, dash.ID)
		assert.Equal(t, savedDash.UID, dash.UID)
		assert.Equal(t, savedDash.Title, dash.Title)
		// nolint:staticcheck
		assert.Equal(t, savedDash.FolderID, dash.FolderID)
		assert.Equal(t, savedDash.FolderUID, dash.FolderUID)
	})
}

func TestIntegrationDashboardDataAccessGivenPluginWithImportedDashboards(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := ProvideDashboardStore(sqlStore, &setting.Cfg{}, testFeatureToggles, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)
	pluginId := "test-app"

	insertTestDashboardForPlugin(t, dashboardStore, "app-test", 1, "", true, pluginId)
	insertTestDashboardForPlugin(t, dashboardStore, "app-test", 1, "", true, pluginId)
	insertTestDashboardForPlugin(t, dashboardStore, "app-dash1", 1, "", false, pluginId)
	insertTestDashboardForPlugin(t, dashboardStore, "app-dash2", 1, "", false, pluginId)

	query := dashboards.GetDashboardsByPluginIDQuery{
		PluginID: pluginId,
		OrgID:    1,
	}

	queryResult, err := dashboardStore.GetDashboardsByPluginID(context.Background(), &query)
	require.NoError(t, err)
	require.Equal(t, len(queryResult), 2)
}

func TestIntegrationDashboard_SortingOptions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := ProvideDashboardStore(sqlStore, &setting.Cfg{}, testFeatureToggles, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)

	dashB := insertTestDashboard(t, dashboardStore, "Beta", 1, 0, "", false)
	dashA := insertTestDashboard(t, dashboardStore, "Alfa", 1, 0, "", false)
	assert.NotZero(t, dashA.ID)
	assert.Less(t, dashB.ID, dashA.ID)
	qNoSort := &dashboards.FindPersistedDashboardsQuery{
		SignedInUser: &user.SignedInUser{
			OrgID:   1,
			UserID:  1,
			OrgRole: org.RoleAdmin,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
	}
	results, err := dashboardStore.FindDashboards(context.Background(), qNoSort)
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, dashA.ID, results[0].ID)
	assert.Equal(t, dashB.ID, results[1].ID)

	qSort := &dashboards.FindPersistedDashboardsQuery{
		SignedInUser: &user.SignedInUser{
			OrgID:   1,
			UserID:  1,
			OrgRole: org.RoleAdmin,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
		Sort: model.SortOption{
			Filter: []model.SortOptionFilter{
				searchstore.TitleSorter{Descending: true},
			},
		},
	}
	results, err = dashboardStore.FindDashboards(context.Background(), qSort)
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, dashB.ID, results[0].ID)
	assert.Equal(t, dashA.ID, results[1].ID)
}

func TestIntegrationDashboard_Filter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)
	insertTestDashboard(t, dashboardStore, "Alfa", 1, 0, "", false)
	dashB := insertTestDashboard(t, dashboardStore, "Beta", 1, 0, "", false)
	qNoFilter := &dashboards.FindPersistedDashboardsQuery{
		SignedInUser: &user.SignedInUser{
			OrgID:   1,
			UserID:  1,
			OrgRole: org.RoleAdmin,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
	}
	results, err := dashboardStore.FindDashboards(context.Background(), qNoFilter)
	require.NoError(t, err)
	require.Len(t, results, 2)

	qFilter := &dashboards.FindPersistedDashboardsQuery{
		SignedInUser: &user.SignedInUser{
			OrgID:   1,
			UserID:  1,
			OrgRole: org.RoleAdmin,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
		Filters: []interface{}{
			searchstore.TitleFilter{
				Dialect: sqlStore.GetDialect(),
				Title:   "Beta",
			},
		},
	}
	results, err = dashboardStore.FindDashboards(context.Background(), qFilter)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, dashB.ID, results[0].ID)
}

func TestGetExistingDashboardByTitleAndFolder(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)
	insertTestDashboard(t, dashboardStore, "Apple", 1, 0, "", false)
	t.Run("Finds a dashboard with existing name in root directory and throws DashboardWithSameNameInFolderExists error", func(t *testing.T) {
		err = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err = getExistingDashboardByTitleAndFolder(sess, &dashboards.Dashboard{Title: "Apple", OrgID: 1}, false, false)
			return err
		})
		require.ErrorIs(t, err, dashboards.ErrDashboardWithSameNameInFolderExists)
	})

	t.Run("Returns no error when dashboard does not exist in root folder", func(t *testing.T) {
		err = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err = getExistingDashboardByTitleAndFolder(sess, &dashboards.Dashboard{Title: "Beta", OrgID: 1}, false, false)
			return err
		})
		require.NoError(t, err)
	})

	t.Run("Finds a dashboard with existing name in specific folder and throws DashboardWithSameNameInFolderExists error", func(t *testing.T) {
		savedFolder := insertTestDashboard(t, dashboardStore, "test dash folder", 1, 0, "", true, "prod", "webapp")
		savedDash := insertTestDashboard(t, dashboardStore, "test dash", 1, savedFolder.ID, savedFolder.UID, false, "prod", "webapp")
		err = sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err = getExistingDashboardByTitleAndFolder(sess, &dashboards.Dashboard{Title: savedDash.Title, FolderUID: savedFolder.UID, OrgID: 1}, false, false)
			return err
		})
		require.ErrorIs(t, err, dashboards.ErrDashboardWithSameNameInFolderExists)
	})
}

func TestIntegrationFindDashboardsByTitle(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore := db.InitTestDB(t)
	cfg := setting.NewCfg()
	quotaService := quotatest.New(false, nil)
	features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders, featuremgmt.FlagPanelTitleSearch)
	dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)

	orgID := int64(1)
	insertTestDashboard(t, dashboardStore, "dashboard under general", orgID, 0, "", false)

	ac := acimpl.ProvideAccessControl(features, zanzana.NewNoopClient())
	folderPermissions := mock.NewMockedPermissionsService()
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	fStore := folderimpl.ProvideStore(sqlStore)
	folderServiceWithFlagOn := folderimpl.ProvideService(fStore, ac, bus.ProvideBus(tracing.InitializeTracerForTest()), dashboardStore,
		folderStore, sqlStore, features, cfg, folderPermissions, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())

	user := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			orgID: {
				dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll},
				dashboards.ActionFoldersRead:    []string{dashboards.ScopeFoldersAll},
				dashboards.ActionFoldersWrite:   []string{dashboards.ScopeFoldersAll},
				dashboards.ActionFoldersCreate:  []string{dashboards.ScopeFoldersAll},
			},
		},
	}

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanSaveValue: true,
		CanViewValue: true,
		// CanEditValue is required to create library elements
		CanEditValue: true,
	})
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	f0, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        "f0",
		SignedInUser: user,
	})
	require.NoError(t, err)

	insertTestDashboard(t, dashboardStore, "dashboard under f0", orgID, 0, f0.UID, false)

	subfolder, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        "subfolder",
		ParentUID:    f0.UID,
		SignedInUser: user,
	})
	require.NoError(t, err)

	insertTestDashboard(t, dashboardStore, "dashboard under subfolder", orgID, 0, subfolder.UID, false)

	type res struct {
		title       string
		folderUID   string
		folderTitle string
	}

	testCases := []struct {
		desc           string
		title          string
		expectedResult res
		typ            string
	}{
		{
			desc:           "find dashboard under general",
			title:          "dashboard under general",
			expectedResult: res{title: "dashboard under general"},
		},
		{
			desc:           "find dashboard under f0",
			title:          "dashboard under f0",
			expectedResult: res{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
		},
		{
			desc:           "find dashboard under subfolder",
			title:          "dashboard under subfolder",
			expectedResult: res{title: "dashboard under subfolder", folderUID: subfolder.UID, folderTitle: subfolder.Title},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
			require.NoError(t, err)
			res, err := dashboardStore.FindDashboards(context.Background(), &dashboards.FindPersistedDashboardsQuery{
				SignedInUser: user,
				Type:         tc.typ,
				Title:        tc.title,
			})
			require.NoError(t, err)
			require.Equal(t, 1, len(res))

			r := tc.expectedResult
			assert.Equal(t, r.title, res[0].Title)
			if r.folderUID != "" {
				assert.Equal(t, r.folderUID, res[0].FolderUID)
			} else {
				assert.Empty(t, res[0].FolderUID)
			}
			if r.folderTitle != "" {
				assert.Equal(t, r.folderTitle, res[0].FolderTitle)
			} else {
				assert.Empty(t, res[0].FolderTitle)
			}
		})
	}
}

func TestIntegrationFindDashboardsByFolder(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sqlStore, cfg := db.InitTestDBWithCfg(t)
	quotaService := quotatest.New(false, nil)
	features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders, featuremgmt.FlagPanelTitleSearch)
	dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, features, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)

	orgID := int64(1)
	insertTestDashboard(t, dashboardStore, "dashboard under general", orgID, 0, "", false)

	ac := acimpl.ProvideAccessControl(features, zanzana.NewNoopClient())
	folderStore := folderimpl.ProvideDashboardFolderStore(sqlStore)
	fStore := folderimpl.ProvideStore(sqlStore)

	folderPermissions, err := testutil.ProvideFolderPermissions(features, cfg, sqlStore)
	require.NoError(t, err)

	folderServiceWithFlagOn := folderimpl.ProvideService(fStore, ac, bus.ProvideBus(tracing.InitializeTracerForTest()), dashboardStore,
		folderStore, sqlStore, features, cfg, folderPermissions, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())

	user := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			orgID: {
				dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll},
				dashboards.ActionFoldersRead:    []string{dashboards.ScopeFoldersAll},
				dashboards.ActionFoldersWrite:   []string{dashboards.ScopeFoldersAll},
				dashboards.ActionFoldersCreate:  []string{dashboards.ScopeFoldersAll},
			},
		},
	}

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
		CanSaveValue: true,
		CanViewValue: true,
		// CanEditValue is required to create library elements
		CanEditValue: true,
	})
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	f0, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        "f0",
		SignedInUser: user,
	})
	require.NoError(t, err)
	// nolint:staticcheck
	insertTestDashboard(t, dashboardStore, "dashboard under f0", orgID, f0.ID, f0.UID, false)

	f1, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        "f1",
		SignedInUser: user,
	})
	require.NoError(t, err)
	// nolint:staticcheck
	insertTestDashboard(t, dashboardStore, "dashboard under f1", orgID, f1.ID, f1.UID, false)

	subfolder, err := folderServiceWithFlagOn.Create(context.Background(), &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        "subfolder",
		ParentUID:    f0.UID,
		SignedInUser: user,
	})
	require.NoError(t, err)

	type res struct {
		title       string
		folderUID   string
		folderTitle string
	}

	testCases := []struct {
		desc string
		// Deprecated: use FolderUID instead
		folderIDs      []int64
		folderUIDs     []string
		query          string
		expectedResult map[string][]res
		typ            string
	}{
		{
			desc:       "find dashboard under general using folder UID",
			folderUIDs: []string{folder.GeneralFolderUID},
			typ:        searchstore.TypeDashboard,
			expectedResult: map[string][]res{
				"":                            {{title: "dashboard under general"}},
				featuremgmt.FlagNestedFolders: {{title: "dashboard under general"}},
			},
		},
		{
			desc:       "find dashboard under general using folder UID",
			folderUIDs: []string{folder.GeneralFolderUID},
			typ:        searchstore.TypeDashboard,
			expectedResult: map[string][]res{
				"":                            {{title: "dashboard under general"}},
				featuremgmt.FlagNestedFolders: {{title: "dashboard under general"}},
			},
		},
		{
			desc:       "find dashboard under f0 using folder UID",
			folderUIDs: []string{f0.UID},
			typ:        searchstore.TypeDashboard,
			expectedResult: map[string][]res{
				"":                            {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title}},
				featuremgmt.FlagNestedFolders: {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title}},
			},
		},
		{
			desc:       "find dashboard under f0 or f1 using folder UID",
			folderUIDs: []string{f0.UID, f1.UID},
			typ:        searchstore.TypeDashboard,
			expectedResult: map[string][]res{
				"": {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
					{title: "dashboard under f1", folderUID: f1.UID, folderTitle: f1.Title}},
				featuremgmt.FlagNestedFolders: {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
					{title: "dashboard under f1", folderUID: f1.UID, folderTitle: f1.Title}},
			},
		},
		{
			desc:       "find dashboard under general or f0 using folder UID",
			folderUIDs: []string{folder.GeneralFolderUID, f0.UID},
			typ:        searchstore.TypeDashboard,
			expectedResult: map[string][]res{
				"": {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
					{title: "dashboard under general"}},
				featuremgmt.FlagNestedFolders: {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
					{title: "dashboard under general"}},
			},
		},
		{
			desc:       "find dashboard under general or f0 or f1 using folder UID",
			folderUIDs: []string{folder.GeneralFolderUID, f0.UID, f1.UID},
			typ:        searchstore.TypeDashboard,
			expectedResult: map[string][]res{
				"": {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
					{title: "dashboard under f1", folderUID: f1.UID, folderTitle: f1.Title},
					{title: "dashboard under general"}},
				featuremgmt.FlagNestedFolders: {{title: "dashboard under f0", folderUID: f0.UID, folderTitle: f0.Title},
					{title: "dashboard under f1", folderUID: f1.UID, folderTitle: f1.Title},
					{title: "dashboard under general"}},
			},
		},
		{
			desc:       "find subfolder",
			folderUIDs: []string{f0.UID},
			typ:        searchstore.TypeFolder,
			expectedResult: map[string][]res{
				"":                            {},
				featuremgmt.FlagNestedFolders: {{title: subfolder.Title, folderUID: f0.UID, folderTitle: f0.Title}},
			},
		},
	}

	for _, tc := range testCases {
		for featureFlags := range tc.expectedResult {
			t.Run(fmt.Sprintf("%s with featureFlags: %v", tc.desc, featureFlags), func(t *testing.T) {
				dashboardStore, err := ProvideDashboardStore(sqlStore, cfg, featuremgmt.WithFeatures(featureFlags), tagimpl.ProvideService(sqlStore), quotaService)
				require.NoError(t, err)
				res, err := dashboardStore.FindDashboards(context.Background(), &dashboards.FindPersistedDashboardsQuery{
					SignedInUser: user,
					Type:         tc.typ,
					FolderUIDs:   tc.folderUIDs,
				})
				require.NoError(t, err)
				require.Equal(t, len(tc.expectedResult[featureFlags]), len(res))

				for i, r := range tc.expectedResult[featureFlags] {
					assert.Equal(t, r.title, res[i].Title)
					if r.folderUID != "" {
						assert.Equal(t, r.folderUID, res[i].FolderUID)
					} else {
						assert.Empty(t, res[i].FolderUID)
					}
					if r.folderTitle != "" {
						assert.Equal(t, r.folderTitle, res[i].FolderTitle)
					} else {
						assert.Empty(t, res[i].FolderTitle)
					}
				}
			})
		}
	}
}

func insertTestRule(t *testing.T, sqlStore db.DB, foderOrgID int64, folderUID string) {
	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		type alertQuery struct {
			RefID         string
			DatasourceUID string
			Model         json.RawMessage
		}
		type alertRule struct {
			ID           int64 `xorm:"pk autoincr 'id'"`
			OrgID        int64 `xorm:"org_id"`
			Title        string
			Updated      time.Time
			UID          string `xorm:"uid"`
			NamespaceUID string `xorm:"namespace_uid"`
			RuleGroup    string
			Condition    string
			Data         []alertQuery
		}
		rule := alertRule{
			OrgID:        foderOrgID,
			NamespaceUID: folderUID,
			UID:          "rule",
			RuleGroup:    "rulegroup",
			Updated:      time.Now(),
			Condition:    "A",
			Data: []alertQuery{
				{
					RefID:         "A",
					DatasourceUID: expr.DatasourceUID,
					Model: json.RawMessage(`{
						"type": "math",
						"expression": "2 + 3 > 1"
						}`),
				},
			},
		}
		_, err := sess.Insert(&rule)
		require.NoError(t, err)
		type alertRuleVersion struct {
			ID               int64  `xorm:"pk autoincr 'id'"`
			RuleOrgID        int64  `xorm:"rule_org_id"`
			RuleUID          string `xorm:"rule_uid"`
			RuleNamespaceUID string `xorm:"rule_namespace_uid"`
			RuleGroup        string
			ParentVersion    int64
			RestoredFrom     int64
			Version          int64
			Created          time.Time
			Title            string
			Condition        string
			Data             []alertQuery
			IntervalSeconds  int64
		}
		ruleVersion := alertRuleVersion{
			RuleOrgID:        rule.OrgID,
			RuleUID:          rule.UID,
			RuleNamespaceUID: rule.NamespaceUID,
			RuleGroup:        rule.RuleGroup,
			Created:          rule.Updated,
			Condition:        rule.Condition,
			Data:             rule.Data,
			ParentVersion:    0,
			RestoredFrom:     0,
			Version:          1,
			IntervalSeconds:  60,
		}
		_, err = sess.Insert(&ruleVersion)
		require.NoError(t, err)
		return err
	})
	require.NoError(t, err)
}

func insertTestDashboard(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64,
	folderId int64, folderUID string, isFolder bool, tags ...interface{}) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		FolderID:  folderId, // nolint:staticcheck
		FolderUID: folderUID,
		IsFolder:  isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
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

func insertTestDashboardForPlugin(t *testing.T, dashboardStore dashboards.Store, title string, orgId int64,
	folderUID string, isFolder bool, pluginId string) *dashboards.Dashboard {
	t.Helper()
	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		IsFolder:  isFolder,
		FolderUID: folderUID,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
		PluginID: pluginId,
	}

	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)

	return dash
}

// testSearchDashboards is a (near) copy of the dashboard service
// SearchDashboards, which is a wrapper around FindDashboards.
func testSearchDashboards(d dashboards.Store, query *dashboards.FindPersistedDashboardsQuery) (model.HitList, error) {
	res, err := d.FindDashboards(context.Background(), query)
	if err != nil {
		return nil, err
	}
	hits := makeQueryResult(query, res)
	return hits, nil
}

func makeQueryResult(query *dashboards.FindPersistedDashboardsQuery, res []dashboards.DashboardSearchProjection) model.HitList {
	hitList := make([]*model.Hit, 0)
	hits := make(map[int64]*model.Hit)

	for _, item := range res {
		hit, exists := hits[item.ID]
		if !exists {
			hitType := model.DashHitDB
			if item.IsFolder {
				hitType = model.DashHitFolder
			}

			hit = &model.Hit{
				ID:          item.ID,
				UID:         item.UID,
				Title:       item.Title,
				URI:         "db/" + item.Slug,
				URL:         dashboards.GetDashboardFolderURL(item.IsFolder, item.UID, item.Slug),
				Type:        hitType,
				FolderUID:   item.FolderUID,
				FolderTitle: item.FolderTitle,
				Tags:        []string{},
			}

			if item.FolderUID != "" {
				hit.FolderURL = dashboards.GetFolderURL(item.FolderUID, item.FolderSlug)
			}

			if query.Sort.MetaName != "" {
				hit.SortMeta = item.SortMeta
				hit.SortMetaName = query.Sort.MetaName
			}

			hitList = append(hitList, hit)
			hits[item.ID] = hit
		}
		if len(item.Term) > 0 {
			hit.Tags = append(hit.Tags, item.Term)
		}
	}
	return hitList
}
