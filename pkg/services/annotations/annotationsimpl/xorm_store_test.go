package annotationsimpl

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationAnnotations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sql := db.InitTestDB(t)
	var maximumTagsLength int64 = 60
	repo := xormRepositoryImpl{db: sql, cfg: setting.NewCfg(), log: log.New("annotation.test"), tagService: tagimpl.ProvideService(sql, sql.Cfg), maximumTagsLength: maximumTagsLength}

	testUser := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionAnnotationsRead: []string{accesscontrol.ScopeAnnotationsAll},
				dashboards.ActionDashboardsRead:     []string{dashboards.ScopeDashboardsAll},
			},
		},
	}

	t.Run("Testing annotation create, read, update and delete", func(t *testing.T) {
		t.Cleanup(func() {
			err := sql.WithDbSession(context.Background(), func(dbSession *db.Session) error {
				_, err := dbSession.Exec("DELETE FROM annotation WHERE 1=1")
				if err != nil {
					return err
				}
				_, err = dbSession.Exec("DELETE FROM annotation_tag WHERE 1=1")
				return err
			})
			assert.NoError(t, err)
		})

		quotaService := quotatest.New(false, nil)
		dashboardStore, err := dashboardstore.ProvideDashboardStore(sql, sql.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sql, sql.Cfg), quotaService)
		require.NoError(t, err)

		testDashboard1 := dashboards.SaveDashboardCommand{
			UserID: 1,
			OrgID:  1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "Dashboard 1",
			}),
		}

		dashboard, err := dashboardStore.SaveDashboard(context.Background(), testDashboard1)
		require.NoError(t, err)

		testDashboard2 := dashboards.SaveDashboardCommand{
			UserID: 1,
			OrgID:  1,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": "Dashboard 2",
			}),
		}
		dashboard2, err := dashboardStore.SaveDashboard(context.Background(), testDashboard2)
		require.NoError(t, err)

		annotation := &annotations.Item{
			OrgID:       1,
			UserID:      1,
			DashboardID: dashboard.ID,
			Text:        "hello",
			Type:        "alert",
			Epoch:       10,
			Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
			Data:        simplejson.NewFromAny(map[string]interface{}{"data1": "I am a cool data", "data2": "I am another cool data"}),
		}
		err = repo.Add(context.Background(), annotation)
		require.NoError(t, err)
		assert.Greater(t, annotation.ID, int64(0))
		assert.Equal(t, annotation.Epoch, annotation.EpochEnd)

		annotation2 := &annotations.Item{
			OrgID:       1,
			UserID:      1,
			DashboardID: dashboard2.ID,
			Text:        "hello",
			Type:        "alert",
			Epoch:       21, // Should swap epoch & epochEnd
			EpochEnd:    20,
			Tags:        []string{"outage", "type:outage", "server:server-1", "error"},
		}
		err = repo.Add(context.Background(), annotation2)
		require.NoError(t, err)
		assert.Greater(t, annotation2.ID, int64(0))
		assert.Equal(t, int64(20), annotation2.Epoch)
		assert.Equal(t, int64(21), annotation2.EpochEnd)

		organizationAnnotation1 := &annotations.Item{
			OrgID:  1,
			UserID: 1,
			Text:   "deploy",
			Type:   "",
			Epoch:  15,
			Tags:   []string{"deploy"},
		}
		err = repo.Add(context.Background(), organizationAnnotation1)
		require.NoError(t, err)
		assert.Greater(t, organizationAnnotation1.ID, int64(0))

		globalAnnotation2 := &annotations.Item{
			OrgID:  1,
			UserID: 1,
			Text:   "rollback",
			Type:   "",
			Epoch:  17,
			Tags:   []string{"rollback"},
		}
		err = repo.Add(context.Background(), globalAnnotation2)
		require.NoError(t, err)
		assert.Greater(t, globalAnnotation2.ID, int64(0))
		t.Run("Can query for annotation by dashboard id", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  dashboard.ID,
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

		badAnnotation := &annotations.Item{
			OrgID:  1,
			UserID: 1,
			Text:   "rollback",
			Type:   "",
			Epoch:  17,
			Tags:   []string{strings.Repeat("a", int(maximumTagsLength+1))},
		}
		err = repo.Add(context.Background(), badAnnotation)
		require.Error(t, err)
		require.ErrorIs(t, err, annotations.ErrBaseTagLimitExceeded)

		t.Run("Can batch-insert annotations", func(t *testing.T) {
			count := 10
			items := make([]annotations.Item, count)
			for i := 0; i < count; i++ {
				items[i] = annotations.Item{
					OrgID: 100,
					Type:  "batch",
					Epoch: 12,
				}
			}

			err := repo.AddMany(context.Background(), items)

			require.NoError(t, err)
			query := &annotations.ItemQuery{OrgID: 100, SignedInUser: testUser}
			inserted, err := repo.Get(context.Background(), query)
			require.NoError(t, err)
			assert.Len(t, inserted, count)
			for _, ins := range inserted {
				require.Equal(t, int64(12), ins.Time)
				require.Equal(t, int64(12), ins.TimeEnd)
				require.Equal(t, ins.Created, ins.Updated)
			}
		})

		t.Run("Can batch-insert annotations with tags", func(t *testing.T) {
			count := 10
			items := make([]annotations.Item, count)
			for i := 0; i < count; i++ {
				items[i] = annotations.Item{
					OrgID: 101,
					Type:  "batch",
					Epoch: 12,
				}
			}
			items[0].Tags = []string{"type:test"}

			err := repo.AddMany(context.Background(), items)

			require.NoError(t, err)
			query := &annotations.ItemQuery{OrgID: 101, SignedInUser: testUser}
			inserted, err := repo.Get(context.Background(), query)
			require.NoError(t, err)
			assert.Len(t, inserted, count)
		})

		t.Run("Can query for annotation by id", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				AnnotationID: annotation2.ID,
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
			assert.Equal(t, annotation2.ID, items[0].ID)
		})

		t.Run("Should not find any when item is outside time range", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         12,
				To:           15,
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when tag filter does not match", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         1,
				To:           15,
				Tags:         []string{"asd"},
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when type filter does not match", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         1,
				To:           15,
				Type:         "alert",
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find one when all tag filters does match", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         1,
				To:           15, // this will exclude the second test annotation
				Tags:         []string{"outage", "error"},
				SignedInUser: testUser,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Should find two annotations using partial match", func(t *testing.T) {
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
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
			items, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
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
				OrgID:        1,
				DashboardID:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Get(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = repo.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{},
			})
			require.NoError(t, err)

			items, err = repo.Get(context.Background(), query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Empty(t, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			data, err := items[0].Data.Map()
			assert.NoError(t, err)
			assert.Equal(t, data, map[string]interface{}{"data1": "I am a cool data", "data2": "I am another cool data"})
		})

		t.Run("Can update annotation with new tags", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Get(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = repo.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag2"},
			})
			require.NoError(t, err)

			items, err = repo.Get(context.Background(), query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Equal(t, []string{"newtag1", "newtag2"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can update annotations with data", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Get(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].ID
			data := simplejson.NewFromAny(map[string]interface{}{"data": "I am a data", "data2": "I am also a data"})
			err = repo.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag2"},
				Data:  data,
			})
			require.NoError(t, err)

			items, err = repo.Get(context.Background(), query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Equal(t, []string{"newtag1", "newtag2"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
			assert.Equal(t, data, items[0].Data)
		})

		t.Run("Can delete annotation", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			items, err := repo.Get(context.Background(), query)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = repo.Delete(context.Background(), &annotations.DeleteParams{ID: annotationId, OrgID: 1})
			require.NoError(t, err)

			items, err = repo.Get(context.Background(), query)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Can delete annotation using dashboard id and panel id", func(t *testing.T) {
			annotation3 := &annotations.Item{
				OrgID:       1,
				UserID:      1,
				DashboardID: dashboard2.ID,
				Text:        "toBeDeletedWithPanelId",
				Type:        "alert",
				Epoch:       11,
				Tags:        []string{"test"},
				PanelID:     20,
			}
			err = repo.Add(context.Background(), annotation3)
			require.NoError(t, err)

			query := &annotations.ItemQuery{
				OrgID:        1,
				AnnotationID: annotation3.ID,
				SignedInUser: testUser,
			}
			items, err := repo.Get(context.Background(), query)
			require.NoError(t, err)

			dashboardId := items[0].DashboardID
			panelId := items[0].PanelID
			err = repo.Delete(context.Background(), &annotations.DeleteParams{DashboardID: dashboardId, PanelID: panelId, OrgID: 1})
			require.NoError(t, err)

			items, err = repo.Get(context.Background(), query)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find tags by key", func(t *testing.T) {
			result, err := repo.GetTags(context.Background(), &annotations.TagsQuery{
				OrgID: 1,
				Tag:   "server",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 1)
			require.Equal(t, "server:server-1", result.Tags[0].Tag)
			require.Equal(t, int64(1), result.Tags[0].Count)
		})

		t.Run("Should find tags by value", func(t *testing.T) {
			result, err := repo.GetTags(context.Background(), &annotations.TagsQuery{
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
			result, err := repo.GetTags(context.Background(), &annotations.TagsQuery{
				OrgID: 0,
				Tag:   "server-1",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})

		t.Run("Should not find tags that do not exist", func(t *testing.T) {
			result, err := repo.GetTags(context.Background(), &annotations.TagsQuery{
				OrgID: 0,
				Tag:   "unknown:tag",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})
	})
}

func TestIntegrationAnnotationListingWithRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sql := db.InitTestDB(t)

	var maximumTagsLength int64 = 60
	repo := xormRepositoryImpl{db: sql, cfg: setting.NewCfg(), log: log.New("annotation.test"), tagService: tagimpl.ProvideService(sql, sql.Cfg), maximumTagsLength: maximumTagsLength}
	quotaService := quotatest.New(false, nil)
	dashboardStore, err := dashboardstore.ProvideDashboardStore(sql, sql.Cfg, featuremgmt.WithFeatures(), tagimpl.ProvideService(sql, sql.Cfg), quotaService)
	require.NoError(t, err)

	testDashboard1 := dashboards.SaveDashboardCommand{
		UserID:   1,
		OrgID:    1,
		IsFolder: false,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"title": "Dashboard 1",
		}),
	}
	dashboard, err := dashboardStore.SaveDashboard(context.Background(), testDashboard1)
	require.NoError(t, err)
	dash1UID := dashboard.UID

	testDashboard2 := dashboards.SaveDashboardCommand{
		UserID: 1,
		OrgID:  1,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"title": "Dashboard 2",
		}),
	}
	_, err = dashboardStore.SaveDashboard(context.Background(), testDashboard2)
	require.NoError(t, err)

	dash1Annotation := &annotations.Item{
		OrgID:       1,
		DashboardID: 1,
		Epoch:       10,
	}
	err = repo.Add(context.Background(), dash1Annotation)
	require.NoError(t, err)

	dash2Annotation := &annotations.Item{
		OrgID:       1,
		DashboardID: 2,
		Epoch:       10,
		Tags:        []string{"foo:bar"},
	}
	err = repo.Add(context.Background(), dash2Annotation)
	require.NoError(t, err)

	organizationAnnotation := &annotations.Item{
		OrgID: 1,
		Epoch: 10,
	}
	err = repo.Add(context.Background(), organizationAnnotation)
	require.NoError(t, err)

	user := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}
	role := setupRBACRole(t, repo, user)

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
			expectedAnnotationIds: []int64{dash1Annotation.ID, dash2Annotation.ID, organizationAnnotation.ID},
		},
		{
			description: "Should find all dashboard annotations",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {dashboards.ScopeDashboardsAll},
			},
			expectedAnnotationIds: []int64{dash1Annotation.ID, dash2Annotation.ID},
		},
		{
			description: "Should find only annotations from dashboards that user can read",
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {fmt.Sprintf("dashboards:uid:%s", dash1UID)},
			},
			expectedAnnotationIds: []int64{dash1Annotation.ID},
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
			expectedAnnotationIds: []int64{organizationAnnotation.ID},
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
			setupRBACPermission(t, repo, role, user)

			results, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				SignedInUser: user,
			})
			if tc.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Len(t, results, len(tc.expectedAnnotationIds))
			for _, r := range results {
				assert.Contains(t, tc.expectedAnnotationIds, r.ID)
			}
		})
	}
}

func setupRBACRole(t *testing.T, repo xormRepositoryImpl, user *user.SignedInUser) *accesscontrol.Role {
	t.Helper()
	var role *accesscontrol.Role
	err := repo.db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role = &accesscontrol.Role{
			OrgID:   user.OrgID,
			UID:     "test_role",
			Name:    "test:role",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err := sess.Insert(role)
		if err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.UserRole{
			OrgID:   role.OrgID,
			RoleID:  role.ID,
			UserID:  user.UserID,
			Created: time.Now(),
		})
		if err != nil {
			return err
		}
		return nil
	})

	require.NoError(t, err)
	return role
}

func setupRBACPermission(t *testing.T, repo xormRepositoryImpl, role *accesscontrol.Role, user *user.SignedInUser) {
	t.Helper()
	err := repo.db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", role.ID); err != nil {
			return err
		}

		var acPermission []accesscontrol.Permission
		for action, scopes := range user.Permissions[user.OrgID] {
			for _, scope := range scopes {
				acPermission = append(acPermission, accesscontrol.Permission{
					RoleID: role.ID, Action: action, Scope: scope, Created: time.Now(), Updated: time.Now(),
				})
			}
		}

		if _, err := sess.InsertMulti(&acPermission); err != nil {
			return err
		}

		return nil
	})

	require.NoError(t, err)
}
