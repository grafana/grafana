//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardDataAccess(t *testing.T) {
	var sqlStore *SQLStore
	var savedFolder, savedDash, savedDash2 *models.Dashboard

	setup := func() {
		sqlStore = InitTestDB(t)
		savedFolder = insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
		savedDash = insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.Id, false, "prod", "webapp")
		insertTestDashboard(t, sqlStore, "test dash 45", 1, savedFolder.Id, false, "prod")
		savedDash2 = insertTestDashboard(t, sqlStore, "test dash 67", 1, 0, false, "prod")
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

		err := GetDashboard(context.Background(), &query)
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

		err := GetDashboard(context.Background(), &query)
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

		err := GetDashboard(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, query.Result.Title, "test dash 23")
		require.Equal(t, query.Result.Slug, "test-dash-23")
		require.Equal(t, query.Result.Id, savedDash.Id)
		require.Equal(t, query.Result.Uid, savedDash.Uid)
		require.False(t, query.Result.IsFolder)
	})

	t.Run("Shouldn't be able to get a dashboard with just an OrgID", func(t *testing.T) {
		setup()
		query := models.GetDashboardQuery{
			OrgId: 1,
		}

		err := GetDashboard(context.Background(), &query)
		require.Equal(t, err, models.ErrDashboardIdentifierNotSet)
	})

	t.Run("Should be able to delete dashboard", func(t *testing.T) {
		setup()
		dash := insertTestDashboard(t, sqlStore, "delete me", 1, 0, false, "delete this")

		err := DeleteDashboard(context.Background(), &models.DeleteDashboardCommand{
			Id:    dash.Id,
			OrgId: 1,
		})
		require.NoError(t, err)
	})

	t.Run("Should retry generation of uid once if it fails.", func(t *testing.T) {
		setup()
		timesCalled := 0
		generateNewUid = func() string {
			timesCalled += 1
			if timesCalled <= 2 {
				return savedDash.Uid
			}
			return util.GenerateShortUID()
		}
		cmd := models.SaveDashboardCommand{
			OrgId: 1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "new dash 12334",
				"tags":  []interface{}{},
			}),
		}
		_, err := sqlStore.SaveDashboard(cmd)
		require.NoError(t, err)

		generateNewUid = util.GenerateShortUID
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
		dashboard, err := sqlStore.SaveDashboard(cmd)
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
		dash, err := sqlStore.SaveDashboard(cmd)
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
		_, err = sqlStore.SaveDashboard(cmd)
		require.NoError(t, err)

		query := models.GetDashboardQuery{
			Id:    savedDash.Id,
			OrgId: 1,
		}

		err = GetDashboard(context.Background(), &query)
		require.NoError(t, err)
		require.Equal(t, query.Result.FolderId, int64(0))
		require.Equal(t, query.Result.CreatedBy, savedDash.CreatedBy)
		require.WithinDuration(t, query.Result.Created, savedDash.Created, 3*time.Second)
		require.Equal(t, query.Result.UpdatedBy, int64(100))
		require.False(t, query.Result.Updated.IsZero())
	})

	t.Run("Should be able to delete empty folder", func(t *testing.T) {
		setup()
		emptyFolder := insertTestDashboard(t, sqlStore, "2 test dash folder", 1, 0, true, "prod", "webapp")

		deleteCmd := &models.DeleteDashboardCommand{Id: emptyFolder.Id}
		err := DeleteDashboard(context.Background(), deleteCmd)
		require.NoError(t, err)
	})

	t.Run("Should be not able to delete a dashboard if force delete rules is disabled", func(t *testing.T) {
		setup()
		deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id, ForceDeleteFolderRules: false}
		err := DeleteDashboard(context.Background(), deleteCmd)
		require.True(t, errors.Is(err, models.ErrFolderContainsAlertRules))
	})

	t.Run("Should be able to delete a dashboard folder and its children if force delete rules is enabled", func(t *testing.T) {
		setup()
		deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id, ForceDeleteFolderRules: true}
		err := DeleteDashboard(context.Background(), deleteCmd)
		require.NoError(t, err)

		query := search.FindPersistedDashboardsQuery{
			OrgId:        1,
			FolderIds:    []int64{savedFolder.Id},
			SignedInUser: &models.SignedInUser{},
		}

		err = sqlStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 0)

		sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
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
		setup()
		cmd := models.SaveDashboardCommand{
			OrgId:     1,
			Overwrite: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    float64(123412321),
				"title": "Expect error",
				"tags":  []interface{}{},
			}),
		}

		_, err := sqlStore.SaveDashboard(cmd)
		require.Equal(t, err, models.ErrDashboardNotFound)
	})

	t.Run("Should not return error if no dashboard is found for update when dashboard id is zero", func(t *testing.T) {
		setup()
		cmd := models.SaveDashboardCommand{
			OrgId:     1,
			Overwrite: true,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":    0,
				"title": "New dash",
				"tags":  []interface{}{},
			}),
		}
		_, err := sqlStore.SaveDashboard(cmd)
		require.NoError(t, err)
	})

	t.Run("Should be able to get dashboard tags", func(t *testing.T) {
		setup()
		query := models.GetDashboardTagsQuery{OrgId: 1}

		err := GetDashboardTags(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 2)
	})

	t.Run("Should be able to search for dashboard folder", func(t *testing.T) {
		setup()
		query := search.FindPersistedDashboardsQuery{
			Title:        "1 test dash folder",
			OrgId:        1,
			SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
		}

		err := sqlStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 1)
		hit := query.Result[0]
		require.Equal(t, hit.Type, search.DashHitFolder)
		require.Equal(t, hit.URL, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
		require.Equal(t, hit.FolderTitle, "")
	})

	t.Run("Should be able to limit search", func(t *testing.T) {
		setup()
		query := search.FindPersistedDashboardsQuery{
			OrgId:        1,
			Limit:        1,
			SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
		}

		err := sqlStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 1)
		require.EqualValues(t, query.Result[0].Title, "1 test dash folder")
	})

	t.Run("Should be able to search beyond limit using paging", func(t *testing.T) {
		setup()
		query := search.FindPersistedDashboardsQuery{
			OrgId:        1,
			Limit:        1,
			Page:         2,
			SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
		}

		err := sqlStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 1)
		require.EqualValues(t, query.Result[0].Title, "test dash 23")
	})

	t.Run("Should be able to filter by tag and type", func(t *testing.T) {
		setup()
		query := search.FindPersistedDashboardsQuery{
			OrgId:        1,
			Type:         "dash-db",
			Tags:         []string{"prod"},
			SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
		}

		err := sqlStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 3)
		require.Equal(t, query.Result[0].Title, "test dash 23")
	})

	t.Run("Should be able to search for a dashboard folder's children", func(t *testing.T) {
		setup()
		query := search.FindPersistedDashboardsQuery{
			OrgId:        1,
			FolderIds:    []int64{savedFolder.Id},
			SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
		}

		err := sqlStore.SearchDashboards(context.Background(), &query)
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
		query := search.FindPersistedDashboardsQuery{
			DashboardIds: []int64{savedDash.Id, savedDash2.Id},
			SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
		}

		err := sqlStore.SearchDashboards(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, len(query.Result), 2)

		hit := query.Result[0]
		require.Equal(t, len(hit.Tags), 2)

		hit2 := query.Result[1]
		require.Equal(t, len(hit2.Tags), 1)
	})

	t.Run("Should be able to search for starred dashboards", func(t *testing.T) {
		setup()
		starredDash := insertTestDashboard(t, sqlStore, "starred dash", 1, 0, false)
		err := sqlStore.StarDashboard(context.Background(), &models.StarDashboardCommand{
			DashboardId: starredDash.Id,
			UserId:      10,
		})
		require.NoError(t, err)

		err = sqlStore.StarDashboard(context.Background(), &models.StarDashboardCommand{
			DashboardId: savedDash.Id,
			UserId:      1,
		})
		require.NoError(t, err)

		query := search.FindPersistedDashboardsQuery{
			SignedInUser: &models.SignedInUser{UserId: 10, OrgId: 1, OrgRole: models.ROLE_EDITOR},
			IsStarred:    true,
		}
		err = sqlStore.SearchDashboards(context.Background(), &query)

		require.NoError(t, err)
		require.Equal(t, len(query.Result), 1)
		require.Equal(t, query.Result[0].Title, "starred dash")
	})
}

func TestDashboardDataAccessGivenPluginWithImportedDashboards(t *testing.T) {
	sqlStore := InitTestDB(t)
	pluginId := "test-app"

	appFolder := insertTestDashboardForPlugin(t, sqlStore, "app-test", 1, 0, true, pluginId)
	insertTestDashboardForPlugin(t, sqlStore, "app-dash1", 1, appFolder.Id, false, pluginId)
	insertTestDashboardForPlugin(t, sqlStore, "app-dash2", 1, appFolder.Id, false, pluginId)

	query := models.GetDashboardsByPluginIdQuery{
		PluginId: pluginId,
		OrgId:    1,
	}

	err := GetDashboardsByPluginId(context.Background(), &query)
	require.NoError(t, err)
	require.Equal(t, len(query.Result), 2)
}

func TestDashboard_SortingOptions(t *testing.T) {
	// insertTestDashboard uses GoConvey's assertions. Workaround.
	t.Run("test with multiple sorting options", func(t *testing.T) {
		sqlStore := InitTestDB(t)
		dashB := insertTestDashboard(t, sqlStore, "Beta", 1, 0, false)
		dashA := insertTestDashboard(t, sqlStore, "Alfa", 1, 0, false)
		assert.NotZero(t, dashA.Id)
		assert.Less(t, dashB.Id, dashA.Id)
		q := &search.FindPersistedDashboardsQuery{
			SignedInUser: &models.SignedInUser{OrgId: 1, UserId: 1, OrgRole: models.ROLE_ADMIN},
			// adding two sorting options (silly no-op example, but it'll complicate the query)
			Filters: []interface{}{
				searchstore.TitleSorter{},
				searchstore.TitleSorter{Descending: true},
			},
		}
		dashboards, err := sqlStore.findDashboards(context.Background(), q)
		require.NoError(t, err)
		require.Len(t, dashboards, 2)
		assert.Equal(t, dashA.Id, dashboards[0].ID)
		assert.Equal(t, dashB.Id, dashboards[1].ID)
	})
}
func insertTestDashboard(t *testing.T, sqlStore *SQLStore, title string, orgId int64,
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
	dash, err := sqlStore.SaveDashboard(cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.Id)
	dash.Data.Set("uid", dash.Uid)
	return dash
}
func insertTestRule(t *testing.T, sqlStore *SQLStore, foderOrgID int64, folderUID string) {
	sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
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
func insertTestDashboardForPlugin(t *testing.T, sqlStore *SQLStore, title string, orgId int64,
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

	dash, err := sqlStore.SaveDashboard(cmd)
	require.NoError(t, err)

	return dash
}
func createUser(t *testing.T, sqlStore *SQLStore, name string, role string, isAdmin bool) models.User {
	t.Helper()
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgId = 1
	setting.AutoAssignOrgRole = role
	currentUserCmd := models.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: isAdmin}
	currentUser, err := sqlStore.CreateUser(context.Background(), currentUserCmd)
	require.NoError(t, err)
	q1 := models.GetUserOrgListQuery{UserId: currentUser.Id}
	err = GetUserOrgList(context.Background(), &q1)
	require.NoError(t, err)
	require.Equal(t, models.RoleType(role), q1.Result[0].Role)
	return *currentUser
}
