// +build integration

package sqlstore

import (
	"context"
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
	t.Run("Testing DB", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given saved dashboard", func(t *testing.T) {
			savedFolder := insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			savedDash := insertTestDashboard(t, sqlStore, "test dash 23", 1, savedFolder.Id, false, "prod", "webapp")
			insertTestDashboard(t, sqlStore, "test dash 45", 1, savedFolder.Id, false, "prod")
			savedDash2 := insertTestDashboard(t, sqlStore, "test dash 67", 1, 0, false, "prod")

			t.Run("Should return dashboard model", func(t *testing.T) {
				require.Equal(t, "test dash 23", savedDash.Title)
				require.Equal(t, "test-dash-23", savedDash.Slug)
				require.NotEqual(t, 0, savedDash.Id)
				require.False(t, savedDash.IsFolder)
				require.Greater(t, savedDash.FolderId, 0)
				require.Greater(t, len(savedDash.Uid), 0)

				require.Equal(t, "1 test dash folder", savedFolder.Title)
				require.Equal(t, "1-test-dash-folder", savedFolder.Slug)
				require.NotEqual(t, 0, savedFolder.Id)
				require.True(t, savedFolder.IsFolder)
				require.Equal(t, 0, savedFolder.FolderId)
				require.Greater(t, len(savedFolder.Uid), 0)
			})

			t.Run("Should be able to get dashboard by id", func(t *testing.T) {
				query := models.GetDashboardQuery{
					Id:    savedDash.Id,
					OrgId: 1,
				}

				err := GetDashboard(&query)
				require.NoError(t, err)

				require.Equal(t, "test dash 23", query.Result.Title)
				require.Equal(t, "test-dash-23", query.Result.Slug)
				require.Equal(t, savedDash.Id, query.Result.Id)
				require.Equal(t, savedDash.Uid, query.Result.Uid)
				require.False(t, query.Result.IsFolder)
			})

			t.Run("Should be able to get dashboard by slug", func(t *testing.T) {
				query := models.GetDashboardQuery{
					Slug:  "test-dash-23",
					OrgId: 1,
				}

				err := GetDashboard(&query)
				require.NoError(t, err)

				require.Equal(t, "test dash 23", query.Result.Title)
				require.Equal(t, "test-dash-23", query.Result.Slug)
				require.Equal(t, savedDash.Id, query.Result.Id)
				require.Equal(t, savedDash.Uid, query.Result.Uid)
				require.False(t, query.Result.IsFolder)
			})

			t.Run("Should be able to get dashboard by uid", func(t *testing.T) {
				query := models.GetDashboardQuery{
					Uid:   savedDash.Uid,
					OrgId: 1,
				}

				err := GetDashboard(&query)
				require.NoError(t, err)

				require.Equal(t, "test dash 23", query.Result.Title)
				require.Equal(t, "test-dash-23", query.Result.Slug)
				require.Equal(t, savedDash.Id, query.Result.Id)
				require.Equal(t, savedDash.Uid, query.Result.Uid)
				require.False(t, query.Result.IsFolder)
			})

			t.Run("Shouldn't be able to get a dashboard with just an OrgID", func(t *testing.T) {
				query := models.GetDashboardQuery{
					OrgId: 1,
				}

				err := GetDashboard(&query)
				require.Equal(t, models.ErrDashboardIdentifierNotSet, err)
			})

			t.Run("Should be able to delete dashboard", func(t *testing.T) {
				dash := insertTestDashboard(t, sqlStore, "delete me", 1, 0, false, "delete this")

				err := DeleteDashboard(&models.DeleteDashboardCommand{
					Id:    dash.Id,
					OrgId: 1,
				})
				require.NoError(t, err)
			})

			t.Run("Should retry generation of uid once if it fails.", func(t *testing.T) {
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
				require.Equal(t, 100, dashboard.CreatedBy)
				require.False(t, dashboard.Created.IsZero())
				require.Equal(t, 100, dashboard.UpdatedBy)
				require.False(t, dashboard.Updated.IsZero())
			})

			t.Run("Should be able to update dashboard by id and remove folderId", func(t *testing.T) {
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
				require.Equal(t, 2, dash.FolderId)

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

				err = GetDashboard(&query)
				require.NoError(t, err)
				require.Equal(t, 0, query.Result.FolderId)
				require.Equal(t, savedDash.CreatedBy, query.Result.CreatedBy)
				So(query.Result.Created, ShouldHappenWithin, 3*time.Second, savedDash.Created)
				require.Equal(t, 100, query.Result.UpdatedBy)
				require.False(t, query.Result.Updated.IsZero())
			})

			t.Run("Should be able to delete empty folder", func(t *testing.T) {
				emptyFolder := insertTestDashboard(t, sqlStore, "2 test dash folder", 1, 0, true, "prod", "webapp")

				deleteCmd := &models.DeleteDashboardCommand{Id: emptyFolder.Id}
				err := DeleteDashboard(deleteCmd)
				require.NoError(t, err)
			})

			t.Run("Should be able to delete a dashboard folder and its children", func(t *testing.T) {
				deleteCmd := &models.DeleteDashboardCommand{Id: savedFolder.Id}
				err := DeleteDashboard(deleteCmd)
				require.NoError(t, err)

				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &models.SignedInUser{},
				}

				err = SearchDashboards(&query)
				require.NoError(t, err)

				require.Equal(t, 0, len(query.Result))
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

				_, err := sqlStore.SaveDashboard(cmd)
				require.Equal(t, models.ErrDashboardNotFound, err)
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
				_, err := sqlStore.SaveDashboard(cmd)
				require.NoError(t, err)
			})

			t.Run("Should be able to get dashboard tags", func(t *testing.T) {
				query := models.GetDashboardTagsQuery{OrgId: 1}

				err := GetDashboardTags(&query)
				require.NoError(t, err)

				require.Equal(t, 2, len(query.Result))
			})

			t.Run("Should be able to search for dashboard folder", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					Title:        "1 test dash folder",
					OrgId:        1,
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				require.NoError(t, err)

				require.Equal(t, 1, len(query.Result))
				hit := query.Result[0]
				require.Equal(t, search.DashHitFolder, hit.Type)
				require.Equal(t, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug), hit.URL)
				require.Equal(t, "", hit.FolderTitle)
			})

			t.Run("Should be able to limit search", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Limit:        1,
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				require.NoError(t, err)

				require.Equal(t, 1, len(query.Result))
				require.Equal(t, "1 test dash folder", query.Result[0].Title)
			})

			t.Run("Should be able to search beyond limit using paging", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Limit:        1,
					Page:         2,
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				require.NoError(t, err)

				require.Equal(t, 1, len(query.Result))
				require.Equal(t, "test dash 23", query.Result[0].Title)
			})

			t.Run("Should be able to filter by tag and type", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Type:         "dash-db",
					Tags:         []string{"prod"},
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				require.NoError(t, err)

				require.Equal(t, 3, len(query.Result))
				require.Equal(t, "test dash 23", query.Result[0].Title)
			})

			t.Run("Should be able to search for a dashboard folder's children", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				require.NoError(t, err)

				require.Equal(t, 2, len(query.Result))
				hit := query.Result[0]
				require.Equal(t, savedDash.Id, hit.ID)
				require.Equal(t, fmt.Sprintf("/d/%s/%s", savedDash.Uid, savedDash.Slug), hit.URL)
				require.Equal(t, savedFolder.Id, hit.FolderID)
				require.Equal(t, savedFolder.Uid, hit.FolderUID)
				require.Equal(t, savedFolder.Title, hit.FolderTitle)
				require.Equal(t, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug), hit.FolderURL)
			})

			t.Run("Should be able to search for dashboard by dashboard ids", func(t *testing.T) {
				t.Run("should be able to find two dashboards by id", func(t *testing.T) {
					query := search.FindPersistedDashboardsQuery{
						DashboardIds: []int64{savedDash.Id, savedDash2.Id},
						SignedInUser: &models.SignedInUser{OrgId: 1, OrgRole: models.ROLE_EDITOR},
					}

					err := SearchDashboards(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))

					hit := query.Result[0]
					require.Equal(t, 2, len(hit.Tags))

					hit2 := query.Result[1]
					require.Equal(t, 1, len(hit2.Tags))
				})
			})

			t.Run("Given two dashboards, one is starred dashboard by user 10, other starred by user 1", func(t *testing.T) {
				starredDash := insertTestDashboard(t, sqlStore, "starred dash", 1, 0, false)
				err := StarDashboard(&models.StarDashboardCommand{
					DashboardId: starredDash.Id,
					UserId:      10,
				})
				require.NoError(t, err)

				err = StarDashboard(&models.StarDashboardCommand{
					DashboardId: savedDash.Id,
					UserId:      1,
				})
				require.NoError(t, err)

				t.Run("Should be able to search for starred dashboards", func(t *testing.T) {
					query := search.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: 10, OrgId: 1, OrgRole: models.ROLE_EDITOR},
						IsStarred:    true,
					}
					err := SearchDashboards(&query)

					require.NoError(t, err)
					require.Equal(t, 1, len(query.Result))
					require.Equal(t, "starred dash", query.Result[0].Title)
				})
			})
		})

		t.Run("Given a plugin with imported dashboards", func(t *testing.T) {
			pluginId := "test-app"

			appFolder := insertTestDashboardForPlugin(t, sqlStore, "app-test", 1, 0, true, pluginId)
			insertTestDashboardForPlugin(t, sqlStore, "app-dash1", 1, appFolder.Id, false, pluginId)
			insertTestDashboardForPlugin(t, sqlStore, "app-dash2", 1, appFolder.Id, false, pluginId)

			t.Run("Should return imported dashboard", func(t *testing.T) {
				query := models.GetDashboardsByPluginIdQuery{
					PluginId: pluginId,
					OrgId:    1,
				}

				err := GetDashboardsByPluginId(&query)
				require.NoError(t, err)
				require.Equal(t, 2, len(query.Result))
			})
		})
	})
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
	err = GetUserOrgList(&q1)
	require.NoError(t, err)
	require.Equal(t, models.RoleType(role), q1.Result[0].Role)

	return *currentUser
}
