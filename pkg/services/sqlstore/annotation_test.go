// +build integration

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestAnnotations(t *testing.T) {
	mockTimeNow()
	defer resetTimeNow()
	InitTestDB(t)
	repo := SQLAnnotationRepo{}

	t.Run("Testing annotation create, read, update and delete", func(t *testing.T) {
		t.Cleanup(func() {
			_, err := x.Exec("DELETE FROM annotation WHERE 1=1")
			assert.NoError(t, err)
			_, err = x.Exec("DELETE FROM annotation_tag WHERE 1=1")
			assert.NoError(t, err)
		})

		annotation := &annotations.Item{
			OrgId:       1,
			UserId:      1,
			DashboardId: 1,
			Text:        "hello",
			Type:        "alert",
			Epoch:       10,
			Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
		}
		err := repo.Save(annotation)
		require.NoError(t, err)
		assert.Greater(t, annotation.Id, int64(0))
		assert.Equal(t, annotation.Epoch, annotation.EpochEnd)

		annotation2 := &annotations.Item{
			OrgId:       1,
			UserId:      1,
			DashboardId: 2,
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

		globalAnnotation1 := &annotations.Item{
			OrgId:  1,
			UserId: 1,
			Text:   "deploy",
			Type:   "",
			Epoch:  15,
			Tags:   []string{"deploy"},
		}
		err = repo.Save(globalAnnotation1)
		require.NoError(t, err)
		assert.Greater(t, globalAnnotation1.Id, int64(0))

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
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        0,
				To:          15,
			})

			require.NoError(t, err)
			assert.Len(t, items, 1)

			assert.Equal(t, []string{"outage", "error", "type:outage", "server:server-1"}, items[0].Tags)

			assert.GreaterOrEqual(t, items[0].Created, int64(0))
			assert.GreaterOrEqual(t, items[0].Updated, int64(0))
			assert.Equal(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can query for annotation by id", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:        1,
				AnnotationId: annotation2.Id,
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
			assert.Equal(t, annotation2.Id, items[0].Id)
		})

		t.Run("Should not find any when item is outside time range", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        12,
				To:          15,
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when tag filter does not match", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        1,
				To:          15,
				Tags:        []string{"asd"},
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should not find one when type filter does not match", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        1,
				To:          15,
				Type:        "alert",
			})
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find one when all tag filters does match", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        1,
				To:          15, // this will exclude the second test annotation
				Tags:        []string{"outage", "error"},
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Should find two annotations using partial match", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:    1,
				From:     1,
				To:       25,
				MatchAny: true,
				Tags:     []string{"rollback", "deploy"},
			})
			require.NoError(t, err)
			assert.Len(t, items, 2)
		})

		t.Run("Should find one when all key value tag filters does match", func(t *testing.T) {
			items, err := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        1,
				To:          15,
				Tags:        []string{"type:outage", "server:server-1"},
			})
			require.NoError(t, err)
			assert.Len(t, items, 1)
		})

		t.Run("Can update annotation and remove all tags", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        0,
				To:          15,
			}
			items, err := repo.Find(query)
			require.NoError(t, err)

			annotationId := items[0].Id
			err = repo.Update(&annotations.Item{
				Id:    annotationId,
				OrgId: 1,
				Text:  "something new",
				Tags:  []string{},
			})
			require.NoError(t, err)

			items, err = repo.Find(query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].Id)
			assert.Empty(t, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
		})

		t.Run("Can update annotation with new tags", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        0,
				To:          15,
			}
			items, err := repo.Find(query)
			require.NoError(t, err)

			annotationId := items[0].Id
			err = repo.Update(&annotations.Item{
				Id:    annotationId,
				OrgId: 1,
				Text:  "something new",
				Tags:  []string{"newtag1", "newtag2"},
			})
			require.NoError(t, err)

			items, err = repo.Find(query)
			require.NoError(t, err)

			assert.Equal(t, annotationId, items[0].Id)
			assert.Equal(t, []string{"newtag1", "newtag2"}, items[0].Tags)
			assert.Equal(t, "something new", items[0].Text)
			assert.Greater(t, items[0].Updated, items[0].Created)
		})

		t.Run("Can delete annotation", func(t *testing.T) {
			query := &annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        0,
				To:          15,
			}
			items, err := repo.Find(query)
			require.NoError(t, err)

			annotationId := items[0].Id
			err = repo.Delete(&annotations.DeleteParams{Id: annotationId, OrgId: 1})
			require.NoError(t, err)

			items, err = repo.Find(query)
			require.NoError(t, err)
			assert.Empty(t, items)
		})

		t.Run("Should find tags by key", func(t *testing.T) {
			result, err := repo.FindTags(&annotations.TagsQuery{
				OrgID: 1,
				Tag:   "server",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 1)
			require.Equal(t, "server:server-1", result.Tags[0].Tag)
			require.Equal(t, int64(1), result.Tags[0].Count)
		})

		t.Run("Should find tags by value", func(t *testing.T) {
			result, err := repo.FindTags(&annotations.TagsQuery{
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
			result, err := repo.FindTags(&annotations.TagsQuery{
				OrgID: 0,
				Tag:   "server-1",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})

		t.Run("Should not find tags that do not exist", func(t *testing.T) {
			result, err := repo.FindTags(&annotations.TagsQuery{
				OrgID: 0,
				Tag:   "unknown:tag",
			})
			require.NoError(t, err)
			require.Len(t, result.Tags, 0)
		})
	})
}
