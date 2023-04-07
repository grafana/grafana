package annotationsimpl

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag"
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
	repo := xormRepositoryImpl{db: sql, cfg: setting.NewCfg(), log: log.New("annotation.test"), tagService: tagimpl.ProvideService(sql, sql.Cfg), maximumTagsLength: maximumTagsLength, features: featuremgmt.WithFeatures()}
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
	role := setupRBACRole(t, sql, user)

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
			setupRBACPermission(t, sql, role, user)

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

func TestIntegrationAnnotationListingWithInheritedRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	orgID := int64(1)
	permissions := []accesscontrol.Permission{
		{
			Action: dashboards.ActionFoldersCreate,
		}, {
			Action: dashboards.ActionFoldersWrite,
			Scope:  dashboards.ScopeFoldersAll,
		},
	}
	usr := &user.SignedInUser{
		UserID:      1,
		OrgID:       orgID,
		Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByAction(permissions)},
	}

	var role *accesscontrol.Role

	dashboardIDs := make([]int64, 0, folder.MaxNestedFolderDepth+1)
	annotationsTexts := make([]string, 0, folder.MaxNestedFolderDepth+1)

	setupFolderStructure := func() *sqlstore.SQLStore {
		db := db.InitTestDB(t)

		// enable nested folders so that the folder table is populated for all the tests
		features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)

		origNewGuardian := guardian.New
		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		// dashboard store commands that should be called.
		dashStore, err := dashboardstore.ProvideDashboardStore(db, db.Cfg, features, tagimpl.ProvideService(db, db.Cfg), quotatest.New(false, nil))
		require.NoError(t, err)

		folderSvc := folderimpl.ProvideService(mock.New(), bus.ProvideBus(tracing.InitializeTracerForTest()), db.Cfg, dashStore, folderimpl.ProvideDashboardFolderStore(db), db, features)

		var maximumTagsLength int64 = 60
		repo := xormRepositoryImpl{db: db, cfg: setting.NewCfg(), log: log.New("annotation.test"), tagService: tagimpl.ProvideService(db, db.Cfg), maximumTagsLength: maximumTagsLength, features: features}

		parentUID := ""
		for i := 0; ; i++ {
			uid := fmt.Sprintf("f%d", i)
			f, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				UID:          uid,
				OrgID:        orgID,
				Title:        uid,
				SignedInUser: usr,
				ParentUID:    parentUID,
			})
			if err != nil {
				if errors.Is(err, folder.ErrMaximumDepthReached) {
					break
				}

				t.Log("unexpected error", "error", err)
				t.Fail()
			}

			dashInFolder := dashboards.SaveDashboardCommand{
				UserID:   usr.UserID,
				OrgID:    orgID,
				IsFolder: false,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": fmt.Sprintf("Dashboard under %s", f.UID),
				}),
				FolderID:  f.ID,
				FolderUID: f.UID,
			}
			dashboard, err := dashStore.SaveDashboard(context.Background(), dashInFolder)
			require.NoError(t, err)

			dashboardIDs = append(dashboardIDs, dashboard.ID)

			parentUID = f.UID

			annotationTxt := fmt.Sprintf("annotation %d", i)
			dash1Annotation := &annotations.Item{
				OrgID:       orgID,
				DashboardID: dashboard.ID,
				Epoch:       10,
				Text:        annotationTxt,
			}
			err = repo.Add(context.Background(), dash1Annotation)
			require.NoError(t, err)

			annotationsTexts = append(annotationsTexts, annotationTxt)
		}

		role = setupRBACRole(t, db, usr)
		return db
	}

	db := setupFolderStructure()

	testCases := []struct {
		desc                   string
		features               featuremgmt.FeatureToggles
		permissions            map[string][]string
		expectedAnnotationText []string
		expectedError          bool
	}{
		{
			desc:     "Should find only annotations from dashboards under folders that user can read",
			features: featuremgmt.WithFeatures(),
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {"folders:uid:f0"},
			},
			expectedAnnotationText: annotationsTexts[:1],
		},
		{
			desc:     "Should find only annotations from dashboards under inherited folders if nested folder are enabled",
			features: featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
			permissions: map[string][]string{
				accesscontrol.ActionAnnotationsRead: {accesscontrol.ScopeAnnotationsTypeDashboard},
				dashboards.ActionDashboardsRead:     {"folders:uid:f0"},
			},
			expectedAnnotationText: annotationsTexts[:],
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			var maximumTagsLength int64 = 60
			repo := xormRepositoryImpl{db: db, cfg: setting.NewCfg(), log: log.New("annotation.test"), tagService: tagimpl.ProvideService(db, db.Cfg), maximumTagsLength: maximumTagsLength, features: tc.features}

			usr.Permissions = map[int64]map[string][]string{1: tc.permissions}
			setupRBACPermission(t, db, role, usr)

			results, err := repo.Get(context.Background(), &annotations.ItemQuery{
				OrgID:        1,
				SignedInUser: usr,
			})
			if tc.expectedError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Len(t, results, len(tc.expectedAnnotationText))
			for _, r := range results {
				assert.Contains(t, tc.expectedAnnotationText, r.Text)
			}
		})
	}
}

func setupRBACRole(t *testing.T, db *sqlstore.SQLStore, user *user.SignedInUser) *accesscontrol.Role {
	t.Helper()
	var role *accesscontrol.Role
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

func setupRBACPermission(t *testing.T, db *sqlstore.SQLStore, role *accesscontrol.Role, user *user.SignedInUser) {
	t.Helper()
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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

func BenchmarkFindTags_10k(b *testing.B) {
	benchmarkFindTags(b, 10000)
}

func BenchmarkFindTags_100k(b *testing.B) {
	benchmarkFindTags(b, 100000)
}

func benchmarkFindTags(b *testing.B, numAnnotations int) {
	sql := db.InitTestDB(b)
	var maximumTagsLength int64 = 60
	repo := xormRepositoryImpl{db: sql, cfg: setting.NewCfg(), log: log.New("annotation.test"), tagService: tagimpl.ProvideService(sql, sql.Cfg), maximumTagsLength: maximumTagsLength}

	type annotationTag struct {
		ID           int64 `xorm:"pk autoincr 'id'"`
		AnnotationID int64 `xorm:"annotation_id"`
		TagID        int64 `xorm:"tag_id"`
	}
	newAnnotations := make([]annotations.Item, 0, numAnnotations)
	newTags := make([]tag.Tag, 0, numAnnotations)
	newAnnotationTags := make([]annotationTag, 0, numAnnotations)
	for i := 0; i < numAnnotations; i++ {
		newAnnotations = append(newAnnotations, annotations.Item{
			ID:          int64(i),
			OrgID:       1,
			UserID:      1,
			DashboardID: int64(i),
			Text:        "hello",
			Type:        "alert",
			Epoch:       10,
			Data:        simplejson.NewFromAny(map[string]interface{}{"data1": "I am a cool data", "data2": "I am another cool data"}),
		})
		newTags = append(newTags, tag.Tag{
			Id:  int64(i),
			Key: fmt.Sprintf("tag%d", i),
		})

		newAnnotationTags = append(newAnnotationTags, annotationTag{
			AnnotationID: int64(i),
			TagID:        int64(1),
		})
	}
	sql.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		batchSize := 1000
		numOfBatches := numAnnotations / batchSize
		for i := 0; i < numOfBatches; i++ {
			_, err := sess.Insert(newAnnotations[i*batchSize : (i+1)*batchSize-1])
			require.NoError(b, err)

			_, err = sess.Insert(newTags[i*batchSize : (i+1)*batchSize-1])
			require.NoError(b, err)

			_, err = sess.Insert(newAnnotationTags[i*batchSize : (i+1)*batchSize-1])
			require.NoError(b, err)
		}
		return nil
	})

	annotationWithTheTag := annotations.Item{
		ID:          int64(numAnnotations) + 1,
		OrgID:       1,
		UserID:      1,
		DashboardID: int64(1),
		Text:        "hello",
		Type:        "alert",
		Epoch:       10,
		Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
		Data:        simplejson.NewFromAny(map[string]interface{}{"data1": "I am a cool data", "data2": "I am another cool data"}),
	}
	err := repo.Add(context.Background(), &annotationWithTheTag)
	require.NoError(b, err)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := repo.GetTags(context.Background(), &annotations.TagsQuery{
			OrgID: 1,
			Tag:   "outage",
		})
		require.NoError(b, err)
		require.Len(b, result.Tags, 2)
		require.Equal(b, "outage", result.Tags[0].Tag)
		require.Equal(b, "type:outage", result.Tags[1].Tag)
		require.Equal(b, int64(1), result.Tags[0].Count)
		require.Equal(b, int64(1), result.Tags[1].Count)
	}
}
