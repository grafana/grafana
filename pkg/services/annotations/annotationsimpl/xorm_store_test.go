package annotationsimpl

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	annotation_ac "github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations/testutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAnnotations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sql := db.InitTestDB(t)

	cfg := setting.NewCfg()
	cfg.AnnotationMaximumTagsLength = 60

	store := NewXormStore(cfg, log.New("annotation.test"), sql, tagimpl.ProvideService(sql))

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

		dashboard := testutil.CreateDashboard(t, sql, cfg, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
			UserID: 1,
			OrgID:  1,
			Dashboard: simplejson.NewFromAny(map[string]any{
				"title": "Dashboard 1",
			}),
		})

		dashboard2 := testutil.CreateDashboard(t, sql, cfg, featuremgmt.WithFeatures(), dashboards.SaveDashboardCommand{
			UserID: 1,
			OrgID:  1,
			Dashboard: simplejson.NewFromAny(map[string]any{
				"title": "Dashboard 2",
			}),
		})

		var err error

		annotation := &annotations.Item{
			OrgID:        1,
			UserID:       1,
			DashboardID:  dashboard.ID, // nolint: staticcheck
			DashboardUID: dashboard.UID,
			Text:         "hello",
			Type:         "alert",
			Epoch:        10,
			Tags:         []string{"outage", "error", "type:outage", "server:server-1"},
			Data:         simplejson.NewFromAny(map[string]any{"data1": "I am a cool data", "data2": "I am another cool data"}),
		}
		err = store.Add(context.Background(), annotation)
		require.NoError(t, err)
		assert.Greater(t, annotation.ID, int64(0))
		assert.Equal(t, annotation.Epoch, annotation.EpochEnd)

		annotation2 := &annotations.Item{
			OrgID:        1,
			UserID:       1,
			DashboardID:  dashboard2.ID, // nolint: staticcheck
			DashboardUID: dashboard2.UID,
			Text:         "hello",
			Type:         "alert",
			Epoch:        21, // Should swap epoch & epochEnd
			EpochEnd:     20,
			Tags:         []string{"outage", "type:outage", "server:server-1", "error"},
		}
		err = store.Add(context.Background(), annotation2)
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
		err = store.Add(context.Background(), organizationAnnotation1)
		require.NoError(t, err)
		assert.Greater(t, organizationAnnotation1.ID, int64(0))

		organizationAnnotation2 := &annotations.Item{
			OrgID:  1,
			UserID: 1,
			Text:   "rollback",
			Type:   "",
			Epoch:  17,
			Tags:   []string{"rollback"},
		}
		err = store.Add(context.Background(), organizationAnnotation2)
		require.NoError(t, err)
		assert.Greater(t, organizationAnnotation2.ID, int64(0))

		t.Run("Can query for annotation by dashboard id", func(t *testing.T) {
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  dashboard.ID, // nolint: staticcheck
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}, &annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard.UID: dashboard.ID,
				},
				CanAccessDashAnnotations: true,
			})

			require.NoError(t, err)
			assert.Len(t, items, 1)

			assert.Equal(t, []string{"outage", "error", "type:outage", "server:server-1"}, items[0].Tags)

			assert.GreaterOrEqual(t, items[0].Created, int64(0))
			assert.GreaterOrEqual(t, items[0].Updated, int64(0))
			assert.Equal(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can query for annotation by dashboard uid", func(t *testing.T) {
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardUID: dashboard.UID,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}, &annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard.UID: dashboard.ID,
				},
				CanAccessDashAnnotations: true,
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
			Tags:   []string{strings.Repeat("a", int(cfg.AnnotationMaximumTagsLength+1))},
		}
		err = store.Add(context.Background(), badAnnotation)
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

			err := store.AddMany(context.Background(), items)

			require.NoError(t, err)
			query := annotations.ItemQuery{OrgID: 100, SignedInUser: testUser}
			accRes := &annotation_ac.AccessResources{CanAccessOrgAnnotations: true}
			inserted, err := store.Get(context.Background(), query, accRes)
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

			err := store.AddMany(context.Background(), items)

			require.NoError(t, err)
			query := annotations.ItemQuery{OrgID: 101, SignedInUser: testUser}
			accRes := &annotation_ac.AccessResources{CanAccessOrgAnnotations: true}
			inserted, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)
			assert.Len(t, inserted, count)
		})

		t.Run("Can query for annotation by id", func(t *testing.T) {
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				AnnotationID: annotation2.ID,
				SignedInUser: testUser,
			}, &annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard2.UID: dashboard2.ID,
				},
				CanAccessDashAnnotations: true,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
			assert.Equal(t, annotation2.ID, items[0].ID)
		})

		t.Run("Should not find any when item is outside time range", func(t *testing.T) {
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         12,
				To:           15,
				SignedInUser: testUser,
			}, accRes)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when tag filter does not match", func(t *testing.T) {
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         1,
				To:           15,
				Tags:         []string{"asd"},
				SignedInUser: testUser,
			}, accRes)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when type filter does not match", func(t *testing.T) {
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         1,
				To:           15,
				Type:         "alert",
				SignedInUser: testUser,
			}, accRes)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find one when all tag filters does match", func(t *testing.T) {
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         1,
				To:           15, // this will exclude the second test annotation
				Tags:         []string{"outage", "error"},
				SignedInUser: testUser,
			}, accRes)
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Should find two annotations using partial match", func(t *testing.T) {
			accRes := &annotation_ac.AccessResources{CanAccessOrgAnnotations: true}
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				From:         1,
				To:           25,
				MatchAny:     true,
				Tags:         []string{"rollback", "deploy"},
				SignedInUser: testUser,
			}, accRes)
			require.NoError(t, err)
			assert.Len(t, items, 2)
		})

		t.Run("Should find one when all key value tag filters does match", func(t *testing.T) {
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         1,
				To:           15,
				Tags:         []string{"type:outage", "server:server-1"},
				SignedInUser: testUser,
			}, accRes)
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Can update annotation and remove all tags", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = store.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{},
			})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Empty(t, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			data, err := items[0].Data.Map()
			assert.NoError(t, err)
			assert.Equal(t, data, map[string]any{"data1": "I am a cool data", "data2": "I am another cool data"})
		})

		t.Run("Can update annotation with new tags", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = store.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag2"},
			})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Equal(t, []string{"newtag1", "newtag2"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can update annotation with additional tags", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = store.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag3"},
			})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Equal(t, []string{"newtag1", "newtag3"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can update annotations with data", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			annotationId := items[0].ID
			data := simplejson.NewFromAny(map[string]any{"data": "I am a data", "data2": "I am also a data"})
			err = store.Update(context.Background(), &annotations.Item{
				ID:    annotationId,
				OrgID: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag2"},
				Data:  data,
			})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].ID)
			assert.Equal(t, []string{"newtag1", "newtag2"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
			assert.Equal(t, data, items[0].Data)
		})

		t.Run("Can delete annotation", func(t *testing.T) {
			query := annotations.ItemQuery{
				OrgID:        1,
				DashboardID:  1, // nolint: staticcheck
				DashboardUID: dashboard.UID,
				From:         0,
				To:           15,
				SignedInUser: testUser,
			}
			accRes := &annotation_ac.AccessResources{
				Dashboards:               map[string]int64{dashboard.UID: 1},
				CanAccessDashAnnotations: true,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			annotationId := items[0].ID
			err = store.Delete(context.Background(), &annotations.DeleteParams{ID: annotationId, OrgID: 1})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Can delete annotation using dashboard id and panel id", func(t *testing.T) {
			annotation3 := &annotations.Item{
				OrgID:        1,
				UserID:       1,
				DashboardID:  dashboard2.ID, // nolint: staticcheck
				DashboardUID: dashboard2.UID,
				Text:         "toBeDeletedWithPanelId",
				Type:         "alert",
				Epoch:        11,
				Tags:         []string{"test"},
				PanelID:      20,
			}
			err = store.Add(context.Background(), annotation3)
			require.NoError(t, err)

			accRes := &annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard2.UID: dashboard2.ID,
				},
				CanAccessDashAnnotations: true,
			}

			query := annotations.ItemQuery{
				OrgID:        1,
				AnnotationID: annotation3.ID,
				SignedInUser: testUser,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			// nolint:staticcheck
			err = store.Delete(context.Background(), &annotations.DeleteParams{DashboardID: items[0].DashboardID, PanelID: items[0].PanelID, OrgID: 1})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Can delete annotation using dashboard uid and panel id", func(t *testing.T) {
			annotation3 := &annotations.Item{
				OrgID:        1,
				UserID:       1,
				DashboardUID: dashboard2.UID,
				Text:         "toBeDeletedWithPanelId",
				Type:         "alert",
				Epoch:        11,
				Tags:         []string{"test"},
				PanelID:      20,
			}
			err = store.Add(context.Background(), annotation3)
			require.NoError(t, err)

			accRes := &annotation_ac.AccessResources{
				Dashboards: map[string]int64{
					dashboard2.UID: dashboard2.ID,
				},
				CanAccessDashAnnotations: true,
			}

			query := annotations.ItemQuery{
				OrgID:        1,
				AnnotationID: annotation3.ID,
				SignedInUser: testUser,
			}
			items, err := store.Get(context.Background(), query, accRes)
			require.NoError(t, err)

			// nolint:staticcheck
			err = store.Delete(context.Background(), &annotations.DeleteParams{DashboardUID: *items[0].DashboardUID, PanelID: items[0].PanelID, OrgID: 1})
			require.NoError(t, err)

			items, err = store.Get(context.Background(), query, accRes)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find tags by key", func(t *testing.T) {
			result, err := store.GetTags(context.Background(), annotations.TagsQuery{
				OrgID: 1,
				Tag:   "SeRvEr", // Use mixed-case to test LIKE case-insensitivity
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 1)
			require.Equal(t, "server:server-1", result.Tags[0].Tag)
			require.Equal(t, int64(1), result.Tags[0].Count)
		})

		t.Run("Should find tags by value", func(t *testing.T) {
			result, err := store.GetTags(context.Background(), annotations.TagsQuery{
				OrgID: 1,
				Tag:   "Outage", // Use mixed-case to test LIKE case-insensitivity
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 2)
			require.Equal(t, "outage", result.Tags[0].Tag)
			require.Equal(t, "type:outage", result.Tags[1].Tag)
			require.Equal(t, int64(1), result.Tags[0].Count)
			require.Equal(t, int64(1), result.Tags[1].Count)
		})

		t.Run("Should not find tags in other org", func(t *testing.T) {
			result, err := store.GetTags(context.Background(), annotations.TagsQuery{
				OrgID: 0,
				Tag:   "server-1",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})

		t.Run("Should not find tags that do not exist", func(t *testing.T) {
			result, err := store.GetTags(context.Background(), annotations.TagsQuery{
				OrgID: 0,
				Tag:   "unknown:tag",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})
	})
}

func BenchmarkFindTags_10k(b *testing.B) {
	benchmarkFindTags(b, 10000)
}

func BenchmarkFindTags_100k(b *testing.B) {
	benchmarkFindTags(b, 100000)
}

func benchmarkFindTags(b *testing.B, numAnnotations int) {
	sql := db.InitTestDB(b)
	cfg := setting.NewCfg()
	cfg.AnnotationMaximumTagsLength = 60
	store := xormRepositoryImpl{db: sql, cfg: cfg, log: log.New("annotation.test"), tagService: tagimpl.ProvideService(sql)}

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
			Data:        simplejson.NewFromAny(map[string]any{"data1": "I am a cool data", "data2": "I am another cool data"}),
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
	err := sql.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
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
	require.NoError(b, err)

	annotationWithTheTag := annotations.Item{
		ID:           int64(numAnnotations) + 1,
		OrgID:        1,
		UserID:       1,
		DashboardID:  1, // nolint: staticcheck
		DashboardUID: "uid",
		Text:         "hello",
		Type:         "alert",
		Epoch:        10,
		Tags:         []string{"outage", "error", "type:outage", "server:server-1"},
		Data:         simplejson.NewFromAny(map[string]any{"data1": "I am a cool data", "data2": "I am another cool data"}),
	}
	err = store.Add(context.Background(), &annotationWithTheTag)
	require.NoError(b, err)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		result, err := store.GetTags(context.Background(), annotations.TagsQuery{
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
