//go:build integration
// +build integration

package sqlstore_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationAnnotations(t *testing.T) {
	sql := sqlstore.InitTestDB(t)
	repo := sqlstore.NewSQLAnnotationRepo(sql)

	testUser := &models.SignedInUser{
		OrgId: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionAnnotationsRead: []string{accesscontrol.ScopeAnnotationsAll},
				dashboards.ActionDashboardsRead:     []string{dashboards.ScopeDashboardsAll},
			},
		},
	}

	t.Run("Testing annotation create, read, update and delete", func(t *testing.T) {
		t.Cleanup(func() {
			err := sql.WithDbSession(context.Background(), func(dbSession *sqlstore.DBSession) error {
				_, err := dbSession.Exec("DELETE FROM annotation WHERE 1=1")
				if err != nil {
					return err
				}
				_, err = dbSession.Exec("DELETE FROM annotation_tag WHERE 1=1")
				return err
			})
			assert.NoError(t, err)
		})

		dashboardStore := dashboardstore.ProvideDashboardStore(sql)

		testDashboard1 := models.SaveDashboardCommand{
			UserId: 1,
			OrgId:  1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "Dashboard 1",
			}),
		}
		dashboard, err := dashboardStore.SaveDashboard(testDashboard1)
		require.NoError(t, err)

		testDashboard2 := models.SaveDashboardCommand{
			UserId: 1,
			OrgId:  1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "Dashboard 2",
			}),
		}
		dashboard2, err := dashboardStore.SaveDashboard(testDashboard2)
		require.NoError(t, err)

		annotation := &annotations.Item{
			OrgId:       1,
			UserId:      1,
			DashboardId: dashboard.Id,
			Text:        "hello",
			Type:        "alert",
			Epoch:       10,
			Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
		}
		err = repo.Save(annotation)
		require.NoError(t, err)
		assert.Greater(t, annotation.Id, int64(0))
		assert.Equal(t, annotation.Epoch, annotation.EpochEnd)

		annotation2 := &annotations.Item{
			OrgId:       1,
			UserId:      1,
			DashboardId: dashboard2.Id,
			Text:        "hello",
			Type:        "alert",
			Epoch:       21, // Should swap epoch & epochEnd
			EpochEnd:    20,
			Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
		}
		err = repo.Save(annotation2)
		require.NoError(t, err)
		assert.Greater(t, annotation2.Id, int64(0))
		assert.Equal(t, int64(20), annotation2.Epoch)
		assert.Equal(t, int64(21), annotation2.EpochEnd)

		organizationAnnotation1 := &annotations.Item{
			OrgId:  1,
			UserId: 1,
			Text:   "deploy",
			Type:   "",
			Epoch:  15,
			Tags:   []string{"deploy"},
		}
		err = repo.Save(organizationAnnotation1)
		require.NoError(t, err)
		assert.Greater(t, organizationAnnotation1.Id, int64(0))

		globalAnnotation2 := &annotations.Item{
			OrgId:  1,
			UserId: 1,
			Text:   "rollback",
			Type:   "",
			Epoch:  17,
			Tags:   []string{"rollback"},
		}
		err = repo.Save(globalAnnotation2)
		require.NoError(t, err)
		assert.Greater(t, globalAnnotation2.Id, int64(0))
		t.Run("Can query for annotation by dashboard id", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  dashboard.Id,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			})

			require.NoError(t, err)
			assert.Len(t, items, 1)

			assert.Equal(t, []string{"outage", "error", "type:outage", "server:server-1"}, items[0].Tags)

			assert.GreaterOrEqual(t, items[0].Created, int64(0))
			assert.GreaterOrEqual(t, items[0].Updated, int64(0))
			assert.Equal(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can query for annotation by id", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				AnnotationId: annotation2.Id,
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
			assert.Equal(t, annotation2.Id, items[0].Id)
		})

		t.Run("Should not find any when item is outside time range", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         12,
				To:           15,
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when tag filter does not match", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         1,
				To:           15,
				Tags:         []string{"asd"},
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when type filter does not match", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         1,
				To:           15,
				Type:         "alert",
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find one when all tag filters does match", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         1,
				To:           15, // this will exclude the second test annotation
				Tags:         []string{"outage", "error"},
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Should find two annotations using partial match", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				From:         1,
				To:           25,
				MatchAny:     true,
				Tags:         []string{"rollback", "deploy"},
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Len(t, items, 2)
		})

		t.Run("Should find one when all key value tag filters does match", func(t *testing.T) {
			items, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         1,
				To:           15,
				Tags:         []string{"type:outage", "server:server-1"},
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Can update annotation and remove all tags", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Find(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].Id
			err = repo.Update(context.Background(), &annotations.Item{
				Id:    annotationId,
				OrgId: 1,
				Text:  "something new",
				Tags:  []string{},
			})
			require.NoError(t, err)

			items, err = repo.Find(context.Background(), query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].Id)
			assert.Empty(t, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
		})

		t.Run("Can update annotation with new tags", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Find(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].Id
			err = repo.Update(context.Background(), &annotations.Item{
				Id:    annotationId,
				OrgId: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag2"},
			})
			require.NoError(t, err)

			items, err = repo.Find(context.Background(), query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].Id)
			assert.Equal(t, []string{"newtag1", "newtag2"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can delete annotation", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgId:        1,
				DashboardId:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Find(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].Id
			err = repo.Delete(context.Background(), &annotations.DeleteParams{Id: annotationId, OrgId: 1})
			require.NoError(t, err)

			items, err = repo.Find(context.Background(), query)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Can delete annotation using dashboard id and panel id", func(t *testing.T) {
			annotation3 := &annotations.Item{
				OrgId:       1,
				UserId:      1,
				DashboardId: dashboard2.Id,
				Text:        "toBeDeletedWithPanelId",
				Type:        "alert",
				Epoch:       11,
				Tags:        []string{"test"},
				PanelId:     20,
			}
			err = repo.Save(annotation3)
			require.NoError(t, err)

			query := &annotations.ItemQuery{
				OrgId:        1,
				AnnotationId: annotation3.Id,
				SignedInUser: testUser,
			}
			items, err := repo.Find(context.Background(), query)
			require.NoError(t, err)

			dashboardId := items[0].DashboardId
			panelId := items[0].PanelId
			err = repo.Delete(context.Background(), &annotations.DeleteParams{DashboardId: dashboardId, PanelId: panelId, OrgId: 1})
			require.NoError(t, err)

			items, err = repo.Find(context.Background(), query)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find tags by key", func(t *testing.T) {
			result, err := repo.FindTags(context.Background(), &annotations.TagsQuery{
				OrgID: 1,
				Tag:   "server",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 1)
			require.Equal(t, "server:server-1", result.Tags[0].Tag)
			require.Equal(t, int64(1), result.Tags[0].Count)
		})

		t.Run("Should find tags by value", func(t *testing.T) {
			result, err := repo.FindTags(context.Background(), &annotations.TagsQuery{
				OrgID: 1,
				Tag:   "outage",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 2)
			require.Equal(t, "outage", result.Tags[0].Tag)
			require.Equal(t, "type:outage", result.Tags[1].Tag)
			require.Equal(t, int64(1), result.Tags[0].Count)
			require.Equal(t, int64(1), result.Tags[1].Count)
		})

		t.Run("Should not find tags in other org", func(t *testing.T) {
			result, err := repo.FindTags(context.Background(), &annotations.TagsQuery{
				OrgID: 0,
				Tag:   "server-1",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})

		t.Run("Should not find tags that do not exist", func(t *testing.T) {
			result, err := repo.FindTags(context.Background(), &annotations.TagsQuery{
				OrgID: 0,
				Tag:   "unknown:tag",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})
	})
}

func TestIntegrationAnnotationListingWithRBAC(t *testing.T) {
	sql := sqlstore.InitTestDB(t, sqlstore.InitTestDBOpt{})
	repo := sqlstore.NewSQLAnnotationRepo(sql)
	dashboardStore := dashboardstore.ProvideDashboardStore(sql)

	testDashboard1 := models.SaveDashboardCommand{
		UserId: 1,
		OrgId:  1,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"title": "Dashboard 1",
		}),
	}
	dashboard, err := dashboardStore.SaveDashboard(testDashboard1)
	require.NoError(t, err)
	dash1UID := dashboard.Uid

	testDashboard2 := models.SaveDashboardCommand{
		UserId: 1,
		OrgId:  1,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"title": "Dashboard 2",
		}),
	}
	_, err = dashboardStore.SaveDashboard(testDashboard2)
	require.NoError(t, err)

	dash1Annotation := &annotations.Item{
		OrgId:       1,
		DashboardId: 1,
		Epoch:       10,
	}
	err = repo.Save(dash1Annotation)
	require.NoError(t, err)

	dash2Annotation := &annotations.Item{
		OrgId:       1,
		DashboardId: 2,
		Epoch:       10,
	}
	err = repo.Save(dash2Annotation)
	require.NoError(t, err)

	organizationAnnotation := &annotations.Item{
		OrgId: 1,
		Epoch: 10,
	}
	err = repo.Save(organizationAnnotation)
	require.NoError(t, err)

	user := &models.SignedInUser{
		UserId: 1,
		OrgId:  1,
	}

	type testStruct struct {
		description           string
		permissions           map[string][]string
		expectedAnnotationIds []int64
		expectedError         bool
	}

	testCases := []testStruct{
		{
			description: "Should find all annotations when has permissions to list all annotations and read all dashboards",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsAll},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{dash1Annotation.Id, dash2Annotation.Id, organizationAnnotation.Id},
		},
		{
			description: "Should find all dashboard annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{dash1Annotation.Id, dash2Annotation.Id},
		},
		{
			description: "Should find only annotations from dashboards that user can read",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {fmt.Sprintf("dashboards:uid:%s", dash1UID)},
			},
			expectedAnnotationIds: []int64{dash1Annotation.Id},
		},
		{
			description: "Should find no annotations if user can't view dashboards or organization annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
			},
			expectedAnnotationIds: []int64{},
		},
		{
			description: "Should find only organization annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeOrganization},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{organizationAnnotation.Id},
		},
		{
			description: "Should error if user doesn't have annotation read permissions",
			permissions: map[string][]string{
				dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll},
			},
			expectedError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			user.Permissions = map[int64]map[string][]string{1: tc.permissions}
			results, err := repo.Find(context.Background(), &annotations.ItemQuery{
				OrgId:        1,
				SignedInUser: user,
			})
			if tc.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Len(t, results, len(tc.expectedAnnotationIds))
			for _, r := range results {
				assert.Contains(t, tc.expectedAnnotationIds, r.Id)
			}
		})
	}
}
