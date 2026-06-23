package folders

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestHasCascadeFinalizer(t *testing.T) {
	require.False(t, HasCascadeFinalizer(&foldersv1.Folder{}))
	require.True(t, HasCascadeFinalizer(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Finalizers: []string{CascadeDeleteFinalizer},
		},
	}))
}

func TestEnsureCascadeFinalizerOnObject(t *testing.T) {
	t.Run("adds finalizer when missing", func(t *testing.T) {
		f := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "a"}}
		ensureCascadeFinalizerOnObject(f)
		require.True(t, HasCascadeFinalizer(f))
	})

	t.Run("skips when already present", func(t *testing.T) {
		f := &foldersv1.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Finalizers: []string{CascadeDeleteFinalizer, "other"},
			},
		}
		ensureCascadeFinalizerOnObject(f)
		require.Len(t, f.Finalizers, 2)
	})

	t.Run("skips when deleting", func(t *testing.T) {
		now := metav1.NewTime(time.Now())
		f := &foldersv1.Folder{
			ObjectMeta: metav1.ObjectMeta{
				DeletionTimestamp: &now,
			},
		}
		ensureCascadeFinalizerOnObject(f)
		require.Empty(t, f.Finalizers)
	})
}

func TestApplyTerminationMetadata(t *testing.T) {
	t.Run("adds finalizer and label when both missing", func(t *testing.T) {
		o := &metav1.ObjectMeta{}
		require.True(t, applyTerminationMetadata(o))
		require.Contains(t, o.Finalizers, CascadeDeleteFinalizer)
		require.Equal(t, TerminatingLabelValue, o.Labels[TerminatingLabel])
	})

	t.Run("adds only the label when the finalizer is already present", func(t *testing.T) {
		o := &metav1.ObjectMeta{Finalizers: []string{CascadeDeleteFinalizer}}
		require.True(t, applyTerminationMetadata(o))
		require.Len(t, o.Finalizers, 1)
		require.Equal(t, TerminatingLabelValue, o.Labels[TerminatingLabel])
	})

	t.Run("adds only the finalizer when the label is already present", func(t *testing.T) {
		o := &metav1.ObjectMeta{Labels: map[string]string{TerminatingLabel: TerminatingLabelValue}}
		require.True(t, applyTerminationMetadata(o))
		require.Contains(t, o.Finalizers, CascadeDeleteFinalizer)
		require.Len(t, o.Labels, 1)
	})

	t.Run("reports no change when both already present", func(t *testing.T) {
		o := &metav1.ObjectMeta{
			Finalizers: []string{CascadeDeleteFinalizer},
			Labels:     map[string]string{TerminatingLabel: TerminatingLabelValue},
		}
		require.False(t, applyTerminationMetadata(o))
	})
}

// fakeFolderStore is a minimal folderGetUpdater that serves one object and records updates.
type fakeFolderStore struct {
	obj         runtime.Object
	getErr      error
	updateErr   error
	updateCalls int
}

func (f *fakeFolderStore) New() runtime.Object { return &foldersv1.Folder{} }

func (f *fakeFolderStore) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	if f.getErr != nil {
		return nil, f.getErr
	}
	return f.obj, nil
}

func (f *fakeFolderStore) Update(ctx context.Context, _ string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	f.updateCalls++
	if f.updateErr != nil {
		return nil, false, f.updateErr
	}
	updated, err := objInfo.UpdatedObject(ctx, f.obj)
	if err != nil {
		return nil, false, err
	}
	f.obj = updated
	return updated, false, nil
}

func TestEnsureTerminationMetadata(t *testing.T) {
	t.Run("stamps finalizer and label when missing", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f"}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Equal(t, 1, store.updateCalls)
		updated := store.obj.(*foldersv1.Folder)
		require.Contains(t, updated.Finalizers, CascadeDeleteFinalizer)
		require.Equal(t, TerminatingLabelValue, updated.Labels[TerminatingLabel])
	})

	t.Run("backfills only the label when the finalizer is already present", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{CascadeDeleteFinalizer},
		}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Equal(t, 1, store.updateCalls)
		updated := store.obj.(*foldersv1.Folder)
		require.Len(t, updated.Finalizers, 1)
		require.Equal(t, TerminatingLabelValue, updated.Labels[TerminatingLabel])
	})

	t.Run("backfills a missing label even when the folder is already terminating", func(t *testing.T) {
		// A terminating folder that somehow lost (or never got) the label would be invisible to the
		// poller; ensureTerminationMetadata must still backfill it so the folder can be finalized.
		now := metav1.NewTime(time.Now())
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:              "f",
			Finalizers:        []string{CascadeDeleteFinalizer},
			DeletionTimestamp: &now,
		}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Equal(t, 1, store.updateCalls)
		require.Equal(t, TerminatingLabelValue, store.obj.(*foldersv1.Folder).Labels[TerminatingLabel])
	})

	t.Run("no update when finalizer and label already present", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{CascadeDeleteFinalizer},
			Labels:     map[string]string{TerminatingLabel: TerminatingLabelValue},
		}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Zero(t, store.updateCalls)
	})

	t.Run("no update when already terminating and fully stamped", func(t *testing.T) {
		now := metav1.NewTime(time.Now())
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:              "f",
			Finalizers:        []string{CascadeDeleteFinalizer},
			Labels:            map[string]string{TerminatingLabel: TerminatingLabelValue},
			DeletionTimestamp: &now,
		}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Zero(t, store.updateCalls)
	})

	t.Run("propagates a get error", func(t *testing.T) {
		store := &fakeFolderStore{getErr: errors.New("boom")}
		_, err := ensureTerminationMetadata(context.Background(), store, "f", "")
		require.Error(t, err)
	})

	t.Run("with a resource-version precondition, fails on mismatch without retrying", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f", ResourceVersion: "10"}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "5")

		require.True(t, apierrors.IsConflict(err))
		require.Zero(t, store.updateCalls, "must not stamp (or retry) when the precondition no longer holds")
	})

	t.Run("with a matching resource-version precondition, stamps", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f", ResourceVersion: "7"}}}

		_, err := ensureTerminationMetadata(context.Background(), store, "f", "7")

		require.NoError(t, err)
		require.Equal(t, 1, store.updateCalls)
		require.Equal(t, TerminatingLabelValue, store.obj.(*foldersv1.Folder).Labels[TerminatingLabel])
	})
}

func TestCheckDeletePreconditions(t *testing.T) {
	folder := func(uid, rv string) *foldersv1.Folder {
		return &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f", UID: types.UID(uid), ResourceVersion: rv}}
	}
	uidPtr := func(s string) *types.UID { u := types.UID(s); return &u }
	rvPtr := func(s string) *string { return &s }

	t.Run("nil options or preconditions is a no-op", func(t *testing.T) {
		require.NoError(t, checkDeletePreconditions(folder("u", "1"), nil))
		require.NoError(t, checkDeletePreconditions(folder("u", "1"), &metav1.DeleteOptions{}))
	})

	t.Run("matching resource version and uid pass", func(t *testing.T) {
		require.NoError(t, checkDeletePreconditions(folder("u", "7"), &metav1.DeleteOptions{
			Preconditions: &metav1.Preconditions{UID: uidPtr("u"), ResourceVersion: rvPtr("7")},
		}))
	})

	t.Run("mismatched resource version conflicts", func(t *testing.T) {
		err := checkDeletePreconditions(folder("u", "7"), &metav1.DeleteOptions{
			Preconditions: &metav1.Preconditions{ResourceVersion: rvPtr("6")},
		})
		require.True(t, apierrors.IsConflict(err))
	})

	t.Run("mismatched uid conflicts", func(t *testing.T) {
		err := checkDeletePreconditions(folder("u", "7"), &metav1.DeleteOptions{
			Preconditions: &metav1.Preconditions{UID: uidPtr("other")},
		})
		require.True(t, apierrors.IsConflict(err))
	})
}

type listerFunc func(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error)

func (f listerFunc) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	return f(ctx, options)
}

func TestDeleteCollectionPerItem(t *testing.T) {
	lister := listerFunc(func(_ context.Context, _ *metainternalversion.ListOptions) (runtime.Object, error) {
		return &foldersv1.FolderList{Items: []foldersv1.Folder{
			{ObjectMeta: metav1.ObjectMeta{Name: "a"}},
			{ObjectMeta: metav1.ObjectMeta{Name: "b"}},
			{ObjectMeta: metav1.ObjectMeta{Name: "c"}},
		}}, nil
	})

	t.Run("delegates a delete per listed item", func(t *testing.T) {
		var deleted []string
		deleteOne := func(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
			deleted = append(deleted, name)
			return nil, false, nil
		}

		out, err := deleteCollectionPerItem(context.Background(), lister, deleteOne, nil, nil, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"a", "b", "c"}, deleted)
		items, err := meta.ExtractList(out)
		require.NoError(t, err)
		require.Len(t, items, 3)
	})

	t.Run("tolerates NotFound from a delegated delete", func(t *testing.T) {
		deleteOne := func(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
			if name == "b" {
				return nil, false, apierrors.NewNotFound(schema.GroupResource{Resource: "folders"}, name)
			}
			return nil, false, nil
		}

		_, err := deleteCollectionPerItem(context.Background(), lister, deleteOne, nil, nil, nil)
		require.NoError(t, err)
	})

	t.Run("stops on the first non-NotFound error", func(t *testing.T) {
		var attempted []string
		deleteOne := func(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
			attempted = append(attempted, name)
			if name == "b" {
				return nil, false, errors.New("boom")
			}
			return nil, false, nil
		}

		_, err := deleteCollectionPerItem(context.Background(), lister, deleteOne, nil, nil, nil)
		require.Error(t, err)
		require.Equal(t, []string{"a", "b"}, attempted, "must stop at the failing item")
	})
}

func TestFinalDeleteOptions(t *testing.T) {
	require.Nil(t, finalDeleteOptions(nil, "9"))

	noPre := &metav1.DeleteOptions{}
	require.Same(t, noPre, finalDeleteOptions(noPre, "9"), "no preconditions: options returned unchanged")

	oldRV := "5"
	uid := types.UID("u")
	orig := &metav1.DeleteOptions{Preconditions: &metav1.Preconditions{ResourceVersion: &oldRV, UID: &uid}}
	got := finalDeleteOptions(orig, "6")
	require.Equal(t, "6", *got.Preconditions.ResourceVersion, "resource version rebased to the post-stamp RV")
	require.Equal(t, uid, *got.Preconditions.UID, "UID precondition preserved")
	require.Equal(t, "5", *orig.Preconditions.ResourceVersion, "original options left untouched")

	// A UID-only precondition must stay UID-only: rebasing it onto the post-stamp RV would make an
	// unrelated concurrent update fail the delete with a spurious conflict.
	uidOnly := &metav1.DeleteOptions{Preconditions: &metav1.Preconditions{UID: &uid}}
	gotUID := finalDeleteOptions(uidOnly, "6")
	require.Nil(t, gotUID.Preconditions.ResourceVersion, "UID-only precondition gains no resource version")
	require.Equal(t, uid, *gotUID.Preconditions.UID, "UID precondition preserved")
}

func TestRemoveTerminationMetadata(t *testing.T) {
	t.Run("removes the cascade finalizer and terminating label", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{CascadeDeleteFinalizer, "other.io/keep"},
			Labels:     map[string]string{TerminatingLabel: TerminatingLabelValue, "keep": "yes"},
		}}}

		_, err := removeTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Equal(t, 1, store.updateCalls)
		updated := store.obj.(*foldersv1.Folder)
		require.Equal(t, []string{"other.io/keep"}, updated.Finalizers)
		require.NotContains(t, updated.Labels, TerminatingLabel)
		require.Equal(t, "yes", updated.Labels["keep"])
	})

	t.Run("removes a stray terminating label even without the finalizer", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:   "f",
			Labels: map[string]string{TerminatingLabel: TerminatingLabelValue},
		}}}

		_, err := removeTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Equal(t, 1, store.updateCalls)
		require.NotContains(t, store.obj.(*foldersv1.Folder).Labels, TerminatingLabel)
	})

	t.Run("no update when neither finalizer nor label is present", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{"other.io/keep"},
		}}}

		_, err := removeTerminationMetadata(context.Background(), store, "f", "")
		require.NoError(t, err)

		require.Zero(t, store.updateCalls)
	})

	t.Run("propagates a get error", func(t *testing.T) {
		store := &fakeFolderStore{getErr: errors.New("boom")}
		_, err := removeTerminationMetadata(context.Background(), store, "f", "")
		require.Error(t, err)
	})
}

// fakeChildSearcher implements only Search (over an embedded ResourceIndexClient) and returns
// children per parent UID, mirroring the folder parent index.
type fakeChildSearcher struct {
	resourcepb.ResourceIndexClient
	childrenByParent map[string][]string
}

func (f *fakeChildSearcher) Search(_ context.Context, in *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	parent := in.Options.Fields[0].Values[0]
	rows := make([]*resourcepb.ResourceTableRow, 0, len(f.childrenByParent[parent]))
	for _, name := range f.childrenByParent[parent] {
		rows = append(rows, &resourcepb.ResourceTableRow{Key: &resourcepb.ResourceKey{Name: name}})
	}
	return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{Rows: rows}}, nil
}

// fakeMultiStore is a folderStore serving several folders by name and recording deletes.
type fakeMultiStore struct {
	folders map[string]*foldersv1.Folder
	deleted []string
}

func (s *fakeMultiStore) New() runtime.Object { return &foldersv1.Folder{} }

func (s *fakeMultiStore) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	f, ok := s.folders[name]
	if !ok {
		return nil, errors.New("not found: " + name)
	}
	return f, nil
}

func (s *fakeMultiStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	updated, err := objInfo.UpdatedObject(ctx, s.folders[name])
	if err != nil {
		return nil, false, err
	}
	s.folders[name] = updated.(*foldersv1.Folder)
	return updated, false, nil
}

func (s *fakeMultiStore) Delete(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	s.deleted = append(s.deleted, name)
	return nil, true, nil
}

func TestMarkDescendants(t *testing.T) {
	// root -> { a -> { b }, c }
	store := &fakeMultiStore{folders: map[string]*foldersv1.Folder{
		"a": {ObjectMeta: metav1.ObjectMeta{Name: "a"}},
		"b": {ObjectMeta: metav1.ObjectMeta{Name: "b"}},
		"c": {ObjectMeta: metav1.ObjectMeta{Name: "c"}},
	}}
	searcher := &fakeChildSearcher{childrenByParent: map[string][]string{
		"root": {"a", "c"},
		"a":    {"b"},
	}}

	require.NoError(t, markDescendants(context.Background(), store, searcher, "ns", "root", 0))

	// Every descendant is marked (finalizer + terminating label) and deleted (deletion timestamp);
	// the root itself is left to the caller.
	require.ElementsMatch(t, []string{"a", "b", "c"}, store.deleted)
	for _, name := range []string{"a", "b", "c"} {
		require.Equal(t, TerminatingLabelValue, store.folders[name].Labels[TerminatingLabel], "label on %s", name)
		require.Contains(t, store.folders[name].Finalizers, CascadeDeleteFinalizer, "finalizer on %s", name)
	}
}
