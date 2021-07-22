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

	. "github.com/smartystreets/goconvey/convey"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardDataAccess(t *testing.T) {
	Convey("Testing DB", t, func() {
		sqlStore := InitTestDB(t)

		Convey("Given saved dashboard", func() {
			savedFolder := insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			savedDash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.Id, false, "prod", "webapp")
			insertTestDashboard(t, sqlStore, "test dash 45", 1, savedFolder.Id, false, "prod")
			savedDash2 := insertTestDashboard(t, sqlStore, "test dash 67", 1, 0, false, "prod")
			insertTestRule(t, sqlStore, savedFolder.OrgId, savedFolder.Uid)

			Convey("Should return dashboard model", func() {
				So(savedDash.Title, ShouldEqual, "test dash 23")
				So(savedDash.Slug, ShouldEqual, "test-dash-23")
				So(savedDash.Id, ShouldNotEqual, 0)
				So(savedDash.IsFolder, ShouldBeFalse)
				So(savedDash.FolderId, ShouldBeGreaterThan, 0)
				So(len(savedDash.Uid), ShouldBeGreaterThan, 0)

				So(savedFolder.Title, ShouldEqual, "1 test dash folder")
				So(savedFolder.Slug, ShouldEqual, "1-test-dash-folder")
				So(savedFolder.Id, ShouldNotEqual, 0)
				So(savedFolder.IsFolder, ShouldBeTrue)
				So(savedFolder.FolderId, ShouldEqual, 0)
				So(len(savedFolder.Uid), ShouldBeGreaterThan, 0)
			})

			Convey("Should be able to get dashboard by id", func() {
				query := models.GetDashboardQuery{
					Id:    savedDash.Id,
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.Id, ShouldEqual, savedDash.Id)
				So(query.Result.Uid, ShouldEqual, savedDash.Uid)
				So(query.Result.IsFolder, ShouldBeFalse)
			})

			Convey("Should be able to get dashboard by slug", func() {
				query := models.GetDashboardQuery{
					Slug:  "test-dash-23",
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.Id, ShouldEqual, savedDash.Id)
				So(query.Result.Uid, ShouldEqual, savedDash.Uid)
				So(query.Result.IsFolder, ShouldBeFalse)
			})

			Convey("Should be able to get dashboard by uid", func() {
				query := models.GetDashboardQuery{
					Uid:   savedDash.Uid,
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.Id, ShouldEqual, savedDash.Id)
				So(query.Result.Uid, ShouldEqual, savedDash.Uid)
				So(query.Result.IsFolder, ShouldBeFalse)
			})

			Convey("Shouldn't be able to get a dashboard with just an OrgID", func() {
				query := models.GetDashboardQuery{
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldEqual, models.ErrDashboardIdentifierNotSet)
			})

			Convey("Should be able to delete dashboard", func() {
				dash := insertTestDashboard(t, sqlStore, "delete me", 1, 0, false, "delete this")

				err := DeleteDashboard(&models.DeleteDashboardCommand{
					Id:    dash.Id,
					OrgId: 1,
				})
				So(err, ShouldBeNil)
			})

			Convey("Should retry generation of uid once if it fails.", func() {
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
				So(err, ShouldBeNil)

				generateNewUid = util.GenerateShortUID
			})

			Convey("Should be able to create dashboard", func() {
				cmd := models.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"title": "folderId",
						"tags":  []interface{}{},
					}),
					UserId: 100,
				}
				dashboard, err := sqlStore.SaveDashboard(cmd)
				So(err, ShouldBeNil)
				So(dashboard.CreatedBy, ShouldEqual, 100)
				So(dashboard.Created.IsZero(), ShouldBeFalse)
				So(dashboard.UpdatedBy, ShouldEqual, 100)
				So(dashboard.Updated.IsZero(), ShouldBeFalse)
			})

			Convey("Should be able to update dashboard by id and remove folderId", func() {
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
				So(err, ShouldBeNil)
				So(dash.FolderId, ShouldEqual, 2)

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
				So(err, ShouldBeNil)

				query := models.GetDashboardQuery{
					Id:    savedDash.Id,
					OrgId: 1,
				}

				err = GetDashboard(&query)
				So(err, ShouldBeNil)
				So(query.Result.FolderId, ShouldEqual, 0)
				So(query.Result.CreatedBy, ShouldEqual, savedDash.CreatedBy)
				So(query.Result.Created, ShouldHappenWithin, 3*time.Second, savedDash.Created)
				So(query.Result.UpdatedBy, ShouldEqual, 100)
				So(query.Result.Updated.IsZero(), ShouldBeFalse)
			})

			Convey("Should be able to delete empty folder", func() {
				emptyFolder := insertTestDashboard(t, sqlStore, "2 test dash folder", 1, 0, true, "prod", "webapp")

				deleteCmd := &models.DeleteDashboardCommand{Id: emptyFolder.Id}
				err := DeleteDashboard(deleteCmd)
				So(err, ShouldBeNil)
			})

			Convey("Should be not able to delete a dashboard if force delete rules is disabled", func() {
				deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id, ForceDeleteFolderRules: false}
				err := DeleteDashboard(deleteCmd)
				So(errors.Is(err, models.ErrFolderContainsAlertRules), ShouldBeTrue)
			})

			Convey("Should be able to delete a dashboard folder and its children if force delete rules is enabled", func() {
				deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id, ForceDeleteFolderRules: true}
				err := DeleteDashboard(deleteCmd)
				So(err, ShouldBeNil)

				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &models.SignedInUser{},
				}

				err = SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 0)

				sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
					var existingRuleID int64
					exists, err := sess.Table("alert_rule").Where("namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)", savedFolder.Id).Cols("id").Get(&existingRuleID)
					require.NoError(t, err)
					So(exists, ShouldBeFalse)

					var existingRuleVersionID int64
					exists, err = sess.Table("alert_rule_version").Where("rule_namespace_uid = (SELECT uid FROM dashboard WHERE id = ?)", savedFolder.Id).Cols("id").Get(&existingRuleVersionID)
					require.NoError(t, err)
					So(exists, ShouldBeFalse)

					return nil
				})
			})

			Convey("Should return error if no dashboard is found for update when dashboard id is greater than zero", func() {
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
				So(err, ShouldEqual, models.ErrDashboardNotFound)
			})

			Convey("Should not return error if no dashboard is found for update when dashboard id is zero", func() {
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
				So(err, ShouldBeNil)
			})

			Convey("Should be able to get dashboard tags", func() {
				query := models.GetDashboardTagsQuery{OrgId: 1}

				err := GetDashboardTags(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
			})

			Convey("Should be able to search for dashboard folder", func() {
				query := search.FindPersistedDashboardsQuery{
					Title:        "1 test dash folder",
					OrgId:        1,
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				hit := query.Result[0]
				So(hit.Type, ShouldEqual, search.DashHitFolder)
				So(hit.URL, ShouldEqual, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
				So(hit.FolderTitle, ShouldEqual, "")
			})

			Convey("Should be able to limit search", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Limit:        1,
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Title, ShouldEqual, "1 test dash folder")
			})

			Convey("Should be able to search beyond limit using paging", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Limit:        1,
					Page:         2,
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Title, ShouldEqual, "test dash 23")
			})

			Convey("Should be able to filter by tag and type", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Type:         "dash-db",
					Tags:         []string{"prod"},
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 3)
				So(query.Result[0].Title, ShouldEqual, "test dash 23")
			})

			Convey("Should be able to search for a dashboard folder's children", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
				hit := query.Result[0]
				So(hit.ID, ShouldEqual, savedDash.Id)
				So(hit.URL, ShouldEqual, fmt.Sprintf("/d/%s/%s", savedDash.Uid, savedDash.Slug))
				So(hit.FolderID, ShouldEqual, savedFolder.Id)
				So(hit.FolderUID, ShouldEqual, savedFolder.Uid)
				So(hit.FolderTitle, ShouldEqual, savedFolder.Title)
				So(hit.FolderURL, ShouldEqual, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
			})

			Convey("Should be able to search for dashboard by dashboard ids", func() {
				Convey("should be able to find two dashboards by id", func() {
					query := search.FindPersistedDashboardsQuery{
						DashboardIds: []int64{savedDash.Id, savedDash2.Id},
						SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
					}

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)

					hit := query.Result[0]
					So(len(hit.Tags), ShouldEqual, 2)

					hit2 := query.Result[1]
					So(len(hit2.Tags), ShouldEqual, 1)
				})
			})

			Convey("Given two dashboards, one is starred dashboard by user 10, other starred by user 1", func() {
				starredDash := insertTestDashboard(t, sqlStore, "starred dash", 1, 0, false)
				err := StarDashboard(&models.StarDashboardCommand{
					DashboardId: starredDash.Id,
					UserId:      10,
				})
				So(err, ShouldBeNil)

				err = StarDashboard(&models.StarDashboardCommand{
					DashboardId: savedDash.Id,
					UserId:      1,
				})
				So(err, ShouldBeNil)

				Convey("Should be able to search for starred dashboards", func() {
					query := search.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: 10, OrgId: 1, OrgRole: models.ROLE_EDITOR},
						IsStarred:    true,
					}
					err := SearchDashboards(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Title, ShouldEqual, "starred dash")
				})
			})
		})

		Convey("Given a plugin with imported dashboards", func() {
			pluginId := "test-app"

			appFolder := insertTestDashboardForPlugin(t, sqlStore, "app-test", 1, 0, true, pluginId)
			insertTestDashboardForPlugin(t, sqlStore, "app-dash1", 1, appFolder.Id, false, pluginId)
			insertTestDashboardForPlugin(t, sqlStore, "app-dash2", 1, appFolder.Id, false, pluginId)

			Convey("Should return imported dashboard", func() {
				query := models.GetDashboardsByPluginIdQuery{
					PluginId: pluginId,
					OrgId:    1,
				}

				err := GetDashboardsByPluginId(&query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 2)
			})
		})
	})
}

func TestDashboard_SortingOptions(t *testing.T) {
	// insertTestDashboard uses GoConvey's assertions. Workaround.
	Convey("test with multiple sorting options", t, func() {
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
		dashboards, err := findDashboards(q)
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
	So(err, ShouldBeNil)

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
	err = GetUserOrgList(&q1)
	require.NoError(t, err)
	require.Equal(t, models.RoleType(role), q1.Result[0].Role)

	return *currentUser
}
