//go:build integration
// +build integration

package database

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/star/starimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationDashboardDataAccess(t *testing.T) {
	var sqlStore *sqlstore.SQLStore
	var savedFolder, savedDash, savedDash2 *models.Dashboard
	var dashboardStore *DashboardStore
	var starService star.Service

	setup := func() {
		sqlStore = sqlstore.InitTestDB(t)
		starService = starimpl.ProvideService(sqlStore)
		dashboardStore = ProvideDashboardStore(sqlStore)
		savedFolder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
		savedDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, savedFolder.Id, false, "prod", "webapp")
		insertTestDashboard(t, dashboardStore, "test dash 45", 1, savedFolder.Id, false, "prod")
		savedDash2 = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod")
		insertTestRule(t, sqlStore, savedFolder.OrgId, savedFolder.Uid)
	}

	t.Run("Should return dashboard model", func(t *testing.T) {
		setup()
		require.Equal(t, savedDash.Title, "test dash 23")
		require.Equal(t, savedDash.Slug, "test-dash-23")
		require.NotEqual(t, savedDash.Id, 0)
		require.False(t, savedDash.IsFolder)
		require.Positive(t, savedDash.FolderId)
		require.Positive(t, len(savedDash.Uid))

		require.Equal(t, savedFolder.Title, "1 test dash folder")
		require.Equal(t, savedFolder.Slug, "1-test-dash-folder")
		require.NotEqual(t, savedFolder.Id, 0)
		require.True(t, savedFolder.IsFolder)
		require.EqualValues(t, savedFolder.FolderId, 0)
		require.Positive(t, len(savedFolder.Uid))
	})

	t.Run("Should be able to get dashboard by id", func(t *testing.T) {
		setup()
		query := models.GetDashboardQuery{
			Id:    savedDash.Id,
			OrgId: 1,
		}

		err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, query.Result.Title, "test dash 23")
		require.Equal(t, query.Result.Slug, "test-dash-23")
		require.Equal(t, query.Result.Id, savedDash.Id)
		require.Equal(t, query.Result.Uid, savedDash.Uid)
		require.False(t, query.Result.IsFolder)
	})

	t.Run("Should be able to get dashboard by slug", func(t *testing.T) {
		setup()
		query := models.GetDashboardQuery{
			Slug:  "test-dash-23",
			OrgId: 1,
		}

		err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, query.Result.Title, "test dash 23")
		require.Equal(t, query.Result.Slug, "test-dash-23")
		require.Equal(t, query.Result.Id, savedDash.Id)
		require.Equal(t, query.Result.Uid, savedDash.Uid)
		require.False(t, query.Result.IsFolder)
	})

	t.Run("Should be able to get dashboard by uid", func(t *testing.T) {
		setup()
		query := models.GetDashboardQuery{
			Uid:   savedDash.Uid,
			OrgId: 1,
		}

		err := dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, query.Result.Title, "test dash 23")
		require.Equal(t, query.Result.Slug, "test-dash-23")
		require.Equal(t, query.Result.Id, savedDash.Id)
		require.Equal(t, query.Result.Uid, savedDash.Uid)
		require.False(t, query.Result.IsFolder)
	})

	t.Run("Should be able to get a dashboard UID by ID", func(t *testing.T) {
		setup()
		query := models.GetDashboardRefByIdQuery{Id: savedDash.Id}
		err := dashboardStore.GetDashboardUIDById(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, query.Result.Uid, savedDash.Uid)
	})

	t.Run("Shouldn't be able to get a dashboard with just an OrgID", func(t *testing.T) {
		setup()
		query := models.GetDashboardQuery{
			OrgId: 1,
		}

		err := dashboardStore.GetDashboard(context.Background(), &query)
		require.Equal(t, err, models.ErrDashboardIdentifierNotSet)
	})

	t.Run("Should be able to get dashboards by IDs & UIDs", func(t *testing.T) {
		setup()
		query := models.GetDashboardsQuery{DashboardIds: []int64{savedDash.Id, savedDash2.Id}}
		err := dashboardStore.GetDashboards(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, len(query.Result), 2)

		query = models.GetDashboardsQuery{DashboardUIds: []string{savedDash.Uid, savedDash2.Uid}}
		err = dashboardStore.GetDashboards(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, len(query.Result), 2)
	})

	t.Run("Should be able to delete dashboard", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, dashboardStore, "delete me", 1, 0, false, "delete this")

		err := dashboardStore.DeleteDashboard(context.Background(), &models.DeleteDashboardCommand{
			Id:    dash.Id,
			OrgId: 1,
		})
		require.NoError(t, err)
	})

	t.Run("Should be able to create dashboard", func(t *testing.T) {
		setup()
		cmd := models.SaveDashboardCommand{
			OrgId: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "folderId",
				"tags":  []interface{}{},
			}),
			UserId: 100,
		}
		dashboard, err := dashboardStore.SaveDashboard(cmd)
		require.NoError(t, err)
		require.EqualValues(t, dashboard.CreatedBy, 100)
		require.False(t, dashboard.Created.IsZero())
		require.EqualValues(t, dashboard.UpdatedBy, 100)
		require.False(t, dashboard.Updated.IsZero())
	})

	t.Run("Should be able to update dashboard by id and remove folderId", func(t *testing.T) {
		setup()
		cmd := models.SaveDashboardCommand{
			OrgId: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    savedDash.Id,
				"title": "folderId",
				"tags":  []interface{}{},
			}),
			Overwrite: true,
			FolderId:  2,
			UserId:    100,
		}
		dash, err := dashboardStore.SaveDashboard(cmd)
		require.NoError(t, err)
		require.EqualValues(t, dash.FolderId, 2)

		cmd = models.SaveDashboardCommand{
			OrgId: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    savedDash.Id,
				"title": "folderId",
				"tags":  []interface{}{},
			}),
			FolderId:  0,
			Overwrite: true,
			UserId:    100,
		}
		_, err = dashboardStore.SaveDashboard(cmd)
		require.NoError(t, err)

		query := models.GetDashboardQuery{
			Id:    savedDash.Id,
			OrgId: 1,
		}

		err = dashboardStore.GetDashboard(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, query.Result.FolderId, int64(0))
		require.Equal(t, query.Result.CreatedBy, savedDash.CreatedBy)
		require.WithinDuration(t, query.Result.Created, savedDash.Created, 3*time.Second)
		require.Equal(t, query.Result.UpdatedBy, int64(100))
		require.False(t, query.Result.Updated.IsZero())
	})

	t.Run("Should be able to delete empty folder", func(t *testing.T) {
		setup()
		emptyFolder := insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, true, "prod", "webapp")

		deleteCmd := &models.DeleteDashboardCommand{Id: emptyFolder.Id}
		err := dashboardStore.DeleteDashboard(context.Background(), deleteCmd)
		require.NoError(t, err)
	})

	t.Run("Should be not able to delete a dashboard if force delete rules is disabled", func(t *testing.T) {
		setup()
		deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id, ForceDeleteFolderRules: false}
		err := dashboardStore.DeleteDashboard(context.Background(), deleteCmd)
		require.True(t, errors.Is(err, models.ErrFolderContainsAlertRules))
	})

	t.Run("Should be able to delete a dashboard folder and its children if force delete rules is enabled", func(t *testing.T) {
		setup()
		deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id, ForceDeleteFolderRules: true}
		err := dashboardStore.DeleteDashboard(context.Background(), deleteCmd)
		require.NoError(t, err)

		query := models.FindPersistedDashboardsQuery{
			OrgId:        1,
			FolderIds:    []int64{savedFolder.Id},
			SignedInUser: &models.SignedInUser{},
		}

		err = dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 0)

		sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			var existingRuleID int64
			exists, err := sess.Table("alert_rule").Where("namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)", savedFolder.Id).Cols("id").Get(&existingRuleID)
			require.NoError(t, err)
			require.False(t, exists)

			var existingRuleVersionID int64
			exists, err = sess.Table("alert_rule_version").Where("rule_namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)", savedFolder.Id).Cols("id").Get(&existingRuleVersionID)
			require.NoError(t, err)
			require.False(t, exists)

			return nil
		})
	})

	t.Run("Should return error if no dashboard is found for update when dashboard id is greater than zero", func(t *testing.T) {
		cmd := models.SaveDashboardCommand{
			OrgId:     1,
			Overwrite: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    float64(123412321),
				"title": "Expect error",
				"tags":  []interface{}{},
			}),
		}

		_, err := dashboardStore.SaveDashboard(cmd)
		require.Equal(t, err, models.ErrDashboardNotFound)
	})

	t.Run("Should not return error if no dashboard is found for update when dashboard id is zero", func(t *testing.T) {
		cmd := models.SaveDashboardCommand{
			OrgId:     1,
			Overwrite: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    0,
				"title": "New dash",
				"tags":  []interface{}{},
			}),
		}
		_, err := dashboardStore.SaveDashboard(cmd)
		require.NoError(t, err)
	})

	t.Run("Should be able to get dashboard tags", func(t *testing.T) {
		setup()
		query := models.GetDashboardTagsQuery{OrgId: 1}

		err := sqlStore.GetDashboardTags(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 2)
	})

	t.Run("Should be able to search for dashboard folder", func(t *testing.T) {
		setup()
		query := models.FindPersistedDashboardsQuery{
			Title: "1 test dash folder",
			OrgId: 1,
			SignedInUser: &models.SignedInUser{
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionFoldersRead: []string{dashboards.ScopeFoldersAll}},
				},
			},
		}

		err := dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 1)
		hit := query.Result[0]
		require.Equal(t, hit.Type, models.DashHitFolder)
		require.Equal(t, hit.URL, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
		require.Equal(t, hit.FolderTitle, "")
	})

	t.Run("Should be able to limit search", func(t *testing.T) {
		setup()
		query := models.FindPersistedDashboardsQuery{
			OrgId: 1,
			Limit: 1,
			SignedInUser: &models.SignedInUser{
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionFoldersRead: []string{dashboards.ScopeFoldersAll}},
				},
			},
		}

		err := dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 1)
		require.EqualValues(t, query.Result[0].Title, "1 test dash folder")
	})

	t.Run("Should be able to search beyond limit using paging", func(t *testing.T) {
		setup()
		query := models.FindPersistedDashboardsQuery{
			OrgId: 1,
			Limit: 1,
			Page:  2,
			SignedInUser: &models.SignedInUser{
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {
						dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll},
						dashboards.ActionFoldersRead:    []string{dashboards.ScopeFoldersAll},
					},
				},
			},
		}

		err := dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 1)
		require.EqualValues(t, query.Result[0].Title, "test dash 23")
	})

	t.Run("Should be able to filter by tag and type", func(t *testing.T) {
		setup()
		query := models.FindPersistedDashboardsQuery{
			OrgId: 1,
			Type:  "dash-db",
			Tags:  []string{"prod"},
			SignedInUser: &models.SignedInUser{
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		err := dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 3)
		require.Equal(t, query.Result[0].Title, "test dash 23")
	})

	t.Run("Should be able to search for a dashboard folder's children", func(t *testing.T) {
		setup()
		query := models.FindPersistedDashboardsQuery{
			OrgId:     1,
			FolderIds: []int64{savedFolder.Id},
			SignedInUser: &models.SignedInUser{
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		err := dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 2)
		hit := query.Result[0]
		require.Equal(t, hit.ID, savedDash.Id)
		require.Equal(t, hit.URL, fmt.Sprintf("/d/%s/%s", savedDash.Uid, savedDash.Slug))
		require.Equal(t, hit.FolderID, savedFolder.Id)
		require.Equal(t, hit.FolderUID, savedFolder.Uid)
		require.Equal(t, hit.FolderTitle, savedFolder.Title)
		require.Equal(t, hit.FolderURL, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
	})

	t.Run("Should be able to search for dashboard by dashboard ids", func(t *testing.T) {
		setup()
		query := models.FindPersistedDashboardsQuery{
			DashboardIds: []int64{savedDash.Id, savedDash2.Id},
			SignedInUser: &models.SignedInUser{
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
		}

		err := dashboardStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 2)

		hit := query.Result[0]
		require.Equal(t, len(hit.Tags), 2)

		hit2 := query.Result[1]
		require.Equal(t, len(hit2.Tags), 1)
	})

	t.Run("Should be able to search for starred dashboards", func(t *testing.T) {
		setup()
		starredDash := insertTestDashboard(t, dashboardStore, "starred dash", 1, 0, false)
		err := starService.Add(context.Background(), &star.StarDashboardCommand{
			DashboardID: starredDash.Id,
			UserID:      10,
		})
		require.NoError(t, err)

		err = starService.Add(context.Background(), &star.StarDashboardCommand{
			DashboardID: savedDash.Id,
			UserID:      1,
		})
		require.NoError(t, err)

		query := models.FindPersistedDashboardsQuery{
			SignedInUser: &models.SignedInUser{
				UserId:  10,
				OrgId:   1,
				OrgRole: models.ROLE_EDITOR,
				Permissions: map[int64]map[string][]string{
					1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
				},
			},
			IsStarred: true,
		}
		err = dashboardStore.SearchDashboards(context.Background(), &query)

		require.NoError(t, err)
		require.Equal(t, len(query.Result), 1)
		require.Equal(t, query.Result[0].Title, "starred dash")
	})
}

func TestIntegrationDashboardDataAccessGivenPluginWithImportedDashboards(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := ProvideDashboardStore(sqlStore)
	pluginId := "test-app"

	appFolder := insertTestDashboardForPlugin(t, dashboardStore, "app-test", 1, 0, true, pluginId)
	insertTestDashboardForPlugin(t, dashboardStore, "app-dash1", 1, appFolder.Id, false, pluginId)
	insertTestDashboardForPlugin(t, dashboardStore, "app-dash2", 1, appFolder.Id, false, pluginId)

	query := models.GetDashboardsByPluginIdQuery{
		PluginId: pluginId,
		OrgId:    1,
	}

	err := dashboardStore.GetDashboardsByPluginID(context.Background(), &query)
	require.NoError(t, err)
	require.Equal(t, len(query.Result), 2)
}

func TestIntegrationDashboard_SortingOptions(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := ProvideDashboardStore(sqlStore)

	dashB := insertTestDashboard(t, dashboardStore, "Beta", 1, 0, false)
	dashA := insertTestDashboard(t, dashboardStore, "Alfa", 1, 0, false)
	assert.NotZero(t, dashA.Id)
	assert.Less(t, dashB.Id, dashA.Id)
	qNoSort := &models.FindPersistedDashboardsQuery{
		SignedInUser: &models.SignedInUser{
			OrgId:   1,
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
	}
	results, err := sqlStore.FindDashboards(context.Background(), qNoSort)
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, dashA.Id, results[0].ID)
	assert.Equal(t, dashB.Id, results[1].ID)

	qSort := &models.FindPersistedDashboardsQuery{
		SignedInUser: &models.SignedInUser{
			OrgId:   1,
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
		Sort: models.SortOption{
			Filter: []models.SortOptionFilter{
				searchstore.TitleSorter{Descending: true},
			},
		},
	}
	results, err = sqlStore.FindDashboards(context.Background(), qSort)
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, dashB.Id, results[0].ID)
	assert.Equal(t, dashA.Id, results[1].ID)

}

func TestIntegrationDashboard_Filter(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	dashboardStore := ProvideDashboardStore(sqlStore)
	insertTestDashboard(t, dashboardStore, "Alfa", 1, 0, false)
	dashB := insertTestDashboard(t, dashboardStore, "Beta", 1, 0, false)
	qNoFilter := &models.FindPersistedDashboardsQuery{
		SignedInUser: &models.SignedInUser{
			OrgId:   1,
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
	}
	results, err := sqlStore.FindDashboards(context.Background(), qNoFilter)
	require.NoError(t, err)
	require.Len(t, results, 2)

	qFilter := &models.FindPersistedDashboardsQuery{
		SignedInUser: &models.SignedInUser{
			OrgId:   1,
			UserId:  1,
			OrgRole: models.ROLE_ADMIN,
			Permissions: map[int64]map[string][]string{
				1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}},
			},
		},
		Filters: []interface{}{
			searchstore.TitleFilter{
				Dialect: sqlStore.Dialect,
				Title:   "Beta",
			},
		},
	}
	results, err = sqlStore.FindDashboards(context.Background(), qFilter)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, dashB.Id, results[0].ID)

}

func insertTestRule(t *testing.T, sqlStore *sqlstore.SQLStore, foderOrgID int64, folderUID string) {
	sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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
					DatasourceUID: "-100",
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
}

func CreateUser(t *testing.T, sqlStore *sqlstore.SQLStore, name string, role string, isAdmin bool) models.User {
	t.Helper()
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgId = 1
	setting.AutoAssignOrgRole = role
	currentUserCmd := models.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: isAdmin}
	currentUser, err := sqlStore.CreateUser(context.Background(), currentUserCmd)
	require.NoError(t, err)
	q1 := models.GetUserOrgListQuery{UserId: currentUser.Id}
	err = sqlStore.GetUserOrgList(context.Background(), &q1)
	require.NoError(t, err)
	require.Equal(t, models.RoleType(role), q1.Result[0].Role)
	return *currentUser
}

func insertTestDashboard(t *testing.T, dashboardStore *DashboardStore, title string, orgId int64,
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

func insertTestDashboardForPlugin(t *testing.T, dashboardStore *DashboardStore, title string, orgId int64,
	folderId int64, isFolder bool, pluginId string) *models.Dashboard {
	t.Helper()
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
		PluginId: pluginId,
	}

	dash, err := dashboardStore.SaveDashboard(cmd)
	require.NoError(t, err)

	return dash
}

func updateDashboardAcl(t *testing.T, dashboardStore *DashboardStore, dashboardID int64,
	items ...models.DashboardAcl) error {
	t.Helper()

	var itemPtrs []*models.DashboardAcl
	for _, it := range items {
		item := it
		item.Created = time.Now()
		item.Updated = time.Now()
		itemPtrs = append(itemPtrs, &item)
	}

	return dashboardStore.UpdateDashboardACL(context.Background(), dashboardID, itemPtrs)
}
