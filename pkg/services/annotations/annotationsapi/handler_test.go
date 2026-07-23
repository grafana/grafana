package annotationsapi

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	annotationpkg "github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestMerge(t *testing.T) {
	item := func(id, timeEnd int64) *annotations.ItemDTO {
		return &annotations.ItemDTO{ID: id, TimeEnd: timeEnd}
	}

	tests := []struct {
		name   string
		new    []*annotations.ItemDTO
		legacy []*annotations.ItemDTO
		limit  int64
		want   []*annotations.ItemDTO
	}{
		{
			name:   "both empty",
			new:    nil,
			legacy: nil,
			limit:  10,
			want:   []*annotations.ItemDTO{},
		},
		{
			name:   "duplicate ID - new store wins, no duplicate",
			new:    []*annotations.ItemDTO{item(1, 10)},
			legacy: []*annotations.ItemDTO{item(1, 10), item(2, 20)},
			limit:  10,
			want:   []*annotations.ItemDTO{item(2, 20), item(1, 10)},
		},
		{
			name:   "Time used as tiebreaker when TimeEnd equal",
			new:    []*annotations.ItemDTO{{ID: 1, TimeEnd: 10, Time: 1}, {ID: 2, TimeEnd: 10, Time: 3}},
			legacy: []*annotations.ItemDTO{{ID: 3, TimeEnd: 10, Time: 2}},
			limit:  10,
			want:   []*annotations.ItemDTO{{ID: 2, TimeEnd: 10, Time: 3}, {ID: 3, TimeEnd: 10, Time: 2}, {ID: 1, TimeEnd: 10, Time: 1}},
		},
		{
			name:   "limit applied after sort",
			new:    []*annotations.ItemDTO{item(1, 30), item(2, 20)},
			legacy: []*annotations.ItemDTO{item(3, 10)},
			limit:  2,
			want:   []*annotations.ItemDTO{item(1, 30), item(2, 20)},
		},
		{
			name:   "limit=0 means no limit",
			new:    []*annotations.ItemDTO{item(1, 30), item(2, 20)},
			legacy: []*annotations.ItemDTO{item(3, 10)},
			limit:  0,
			want:   []*annotations.ItemDTO{item(1, 30), item(2, 20), item(3, 10)},
		},
		{
			name:   "new-store point interleaves with legacy by end time",
			new:    []*annotations.ItemDTO{{ID: 1, Time: 20, TimeEnd: 20}},
			legacy: []*annotations.ItemDTO{item(2, 30), item(3, 10)},
			limit:  10,
			want:   []*annotations.ItemDTO{item(2, 30), {ID: 1, Time: 20, TimeEnd: 20}, item(3, 10)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Merge(tt.new, tt.legacy, tt.limit)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestItemAnnotationConversion(t *testing.T) {
	t.Run("present data round-trips through the legacyData annotation", func(t *testing.T) {
		data := simplejson.NewFromAny(map[string]any{"foo": "bar"})
		anno, err := itemToAnnotation(&annotations.Item{Text: "hello", Data: data})
		require.NoError(t, err)

		stored, ok := annotationpkg.GetLegacyData(anno)
		require.True(t, ok, "legacyData annotation should be set")
		require.JSONEq(t, `{"foo":"bar"}`, stored)

		dto, err := annoToItemDTO(anno)
		require.NoError(t, err)
		require.NotNil(t, dto.Data)
		require.Equal(t, data.MustMap(), dto.Data.MustMap())
	})

	t.Run("nil data sets no annotation and reads back nil", func(t *testing.T) {
		anno, err := itemToAnnotation(&annotations.Item{Text: "hello"})
		require.NoError(t, err)

		_, ok := annotationpkg.GetLegacyData(anno)
		require.False(t, ok, "legacyData annotation should be absent when item has no data")

		dto, err := annoToItemDTO(anno)
		require.NoError(t, err)
		require.Nil(t, dto.Data)
	})

	t.Run("empty legacyData annotation reads back nil", func(t *testing.T) {
		anno, err := itemToAnnotation(&annotations.Item{Text: "hello"})
		require.NoError(t, err)
		annotationpkg.SetLegacyData(anno, "")

		dto, err := annoToItemDTO(anno)
		require.NoError(t, err)
		require.Nil(t, dto.Data)
	})

	t.Run("point annotation reads back TimeEnd == Time", func(t *testing.T) {
		anno, err := itemToAnnotation(&annotations.Item{Text: "hello", Epoch: 1234})
		require.NoError(t, err)
		require.Nil(t, anno.Spec.TimeEnd, "a point annotation has no spec TimeEnd")

		dto, err := annoToItemDTO(anno)
		require.NoError(t, err)
		require.Equal(t, int64(1234), dto.Time)
		require.Equal(t, int64(1234), dto.TimeEnd, "point TimeEnd must match Time to align with legacy")
	})

	t.Run("range annotation preserves a distinct TimeEnd", func(t *testing.T) {
		anno, err := itemToAnnotation(&annotations.Item{Text: "hello", Epoch: 1000, EpochEnd: 2000})
		require.NoError(t, err)
		require.NotNil(t, anno.Spec.TimeEnd)

		dto, err := annoToItemDTO(anno)
		require.NoError(t, err)
		require.Equal(t, int64(1000), dto.Time)
		require.Equal(t, int64(2000), dto.TimeEnd)
	})

	t.Run("malformed stored legacy data returns a partialDecodeError and a usable DTO", func(t *testing.T) {
		anno, err := itemToAnnotation(&annotations.Item{Text: "hello"})
		require.NoError(t, err)
		annotationpkg.SetLegacyData(anno, "{not json")

		dto, err := annoToItemDTO(anno)
		require.Error(t, err)

		var decodeErr *partialDecodeError
		require.ErrorAs(t, err, &decodeErr)
		require.Equal(t, []string{"data"}, decodeErr.Fields)

		// The annotation is still usable; only the Data field is dropped.
		require.NotNil(t, dto)
		require.Equal(t, "hello", dto.Text)
		require.Nil(t, dto.Data)
	})
}

// fakeClient records the create/update/delete calls MigrationProxy makes against
// the new store, letting the tests below observe the re-create path.
type fakeClient struct {
	annotationClient

	existing *annotationV0.Annotation

	created *annotationV0.Annotation
	updated *annotationV0.Annotation

	deletedNames []string
	deleteErr    error
	createErr    error
}

func (f *fakeClient) GetByLegacyID(context.Context, int64, int64) (*annotationV0.Annotation, error) {
	return f.existing, nil
}
func (f *fakeClient) Create(_ context.Context, _ int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	f.created = anno
	return anno, f.createErr
}
func (f *fakeClient) Update(_ context.Context, _ int64, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	f.updated = anno
	return anno, nil
}
func (f *fakeClient) Delete(_ context.Context, _ int64, name string) error {
	f.deletedNames = append(f.deletedNames, name)
	return f.deleteErr
}

func TestMigrationProxy(t *testing.T) {
	t.Run("Update", func(t *testing.T) {
		const orgID, legacyID = int64(1), int64(42)

		existingAnno := func(name string) *annotationV0.Annotation {
			anno := &annotationV0.Annotation{
				ObjectMeta: metav1.ObjectMeta{Name: name, ResourceVersion: "7"},
				Spec:       annotationV0.AnnotationSpec{Text: "before", Time: 1000},
			}
			annotationpkg.SetLegacyID(anno, legacyID)
			return anno
		}

		newProxy := func(client annotationClient) *MigrationProxy {
			return &MigrationProxy{client: client, logger: log.New("test")}
		}

		t.Run("time unchanged updates in place, no re-create", func(t *testing.T) {
			client := &fakeClient{existing: existingAnno("anno-1")}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "after", Epoch: 1000})
			require.NoError(t, err)

			require.NotNil(t, client.updated, "an in-place edit must call Update")
			assert.Equal(t, "anno-1", client.updated.GetName(), "in-place edit reuses the stored k8s name")
			assert.Nil(t, client.created, "no re-create when the time is unchanged")
			assert.Empty(t, client.deletedNames, "no delete when the time is unchanged")
		})

		t.Run("text-only PUT with omitted times updates in place and preserves the stored time range", func(t *testing.T) {
			existing := existingAnno("anno-1")
			existing.Spec.TimeEnd = ptr.To(int64(2000))
			client := &fakeClient{existing: existing}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "after"})
			require.NoError(t, err)

			require.NotNil(t, client.updated, "omitted times must not trigger a re-create")
			assert.Equal(t, int64(1000), client.updated.Spec.Time, "the stored time is preserved")
			require.NotNil(t, client.updated.Spec.TimeEnd, "the stored timeEnd is preserved, not dropped")
			assert.Equal(t, int64(2000), *client.updated.Spec.TimeEnd)
			assert.Nil(t, client.created, "no re-create when the times are omitted")
			assert.Empty(t, client.deletedNames, "no delete when the times are omitted")
		})

		t.Run("point-annotation PATCH round-trip does not falsely detect a time change", func(t *testing.T) {
			existing := existingAnno("anno-1")
			client := &fakeClient{existing: existing}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "after", Epoch: 1000, EpochEnd: 1000})
			require.NoError(t, err)

			require.NotNil(t, client.updated, "a point edit must update in place, not re-create")
			assert.Nil(t, client.updated.Spec.TimeEnd, "the point must stay a point, not become a range")
			assert.Nil(t, client.created, "no re-create for an unchanged point")
			assert.Empty(t, client.deletedNames)
		})

		t.Run("moving a point to a later time keeps it a point", func(t *testing.T) {
			existing := existingAnno("anno-1")
			client := &fakeClient{existing: existing}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "after", Epoch: 5000, EpochEnd: 1000})
			require.NoError(t, err)

			require.NotNil(t, client.created, "moving the time re-creates the record")
			assert.Equal(t, int64(5000), client.created.Spec.Time, "the new start is applied")
			assert.Nil(t, client.created.Spec.TimeEnd, "the point stays a point, not a backwards range")
			assert.Equal(t, []string{"anno-1"}, client.deletedNames)
		})

		t.Run("widening a point into a genuine range is honored", func(t *testing.T) {
			existing := existingAnno("anno-1") // Time: 1000, TimeEnd: nil (a point)
			client := &fakeClient{existing: existing}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "after", Epoch: 1000, EpochEnd: 3000})
			require.NoError(t, err)

			require.NotNil(t, client.created, "adding a distinct end changes the time shape, so it re-creates")
			require.NotNil(t, client.created.Spec.TimeEnd, "a strictly-later end makes it a range")
			assert.Equal(t, int64(3000), *client.created.Spec.TimeEnd)
		})

		t.Run("time change with omitted data preserves the stored legacy data", func(t *testing.T) {
			existing := existingAnno("anno-1")
			annotationpkg.SetLegacyData(existing, `{"foo":"bar"}`)
			client := &fakeClient{existing: existing}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "before", Epoch: 5000})
			require.NoError(t, err)

			require.NotNil(t, client.created, "a time edit re-creates the record")
			stored, ok := annotationpkg.GetLegacyData(client.created)
			require.True(t, ok, "legacy data must be carried onto the re-created record")
			assert.JSONEq(t, `{"foo":"bar"}`, stored)
		})

		t.Run("time change re-creates under a new name and deletes the old record", func(t *testing.T) {
			client := &fakeClient{existing: existingAnno("anno-1")}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "before", Epoch: 5000})
			require.NoError(t, err)

			require.NotNil(t, client.created, "a time edit must create a new record")
			assert.Empty(t, client.created.GetName(), "the new record must not carry the old k8s name")
			assert.Equal(t, "a-", client.created.GetGenerateName(), "the new record must ask the store for a fresh name")
			assert.Empty(t, client.created.GetResourceVersion(), "the new record must not carry the old resourceVersion")
			assert.Equal(t, int64(5000), client.created.Spec.Time, "the new record carries the new time")
			assert.Equal(t, legacyID, annotationpkg.GetLegacyID(client.created), "the legacy ID is preserved across the re-create")

			assert.Nil(t, client.updated, "a time edit must not update in place")
			assert.Equal(t, []string{"anno-1"}, client.deletedNames, "the old record must be deleted")
		})

		t.Run("timeEnd change re-creates as well", func(t *testing.T) {
			client := &fakeClient{existing: existingAnno("anno-1")}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "before", Epoch: 1000, EpochEnd: 2000})
			require.NoError(t, err)

			require.NotNil(t, client.created)
			require.NotNil(t, client.created.Spec.TimeEnd)
			assert.Equal(t, int64(2000), *client.created.Spec.TimeEnd)
			assert.Equal(t, []string{"anno-1"}, client.deletedNames)
		})

		t.Run("re-create succeeds even when the best-effort delete of the old record fails", func(t *testing.T) {
			client := &fakeClient{existing: existingAnno("anno-1"), deleteErr: assert.AnError}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "before", Epoch: 5000})
			require.NoError(t, err, "a failed cleanup delete must not fail the update")

			require.NotNil(t, client.created, "the new record is still created")
			assert.Equal(t, []string{"anno-1"}, client.deletedNames, "the delete was attempted")
		})

		t.Run("re-create propagates a failure to create the new record", func(t *testing.T) {
			client := &fakeClient{existing: existingAnno("anno-1"), createErr: assert.AnError}
			proxy := newProxy(client)

			err := proxy.Update(context.Background(), orgID, legacyID, &annotations.Item{Text: "before", Epoch: 5000})
			require.ErrorIs(t, err, assert.AnError)
			assert.Empty(t, client.deletedNames, "the old record must not be deleted if the new one was not created")
		})
	})
}
