package folders

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

		require.NoError(t, ensureTerminationMetadata(context.Background(), store, "f"))

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

		require.NoError(t, ensureTerminationMetadata(context.Background(), store, "f"))

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

		require.NoError(t, ensureTerminationMetadata(context.Background(), store, "f"))

		require.Equal(t, 1, store.updateCalls)
		require.Equal(t, TerminatingLabelValue, store.obj.(*foldersv1.Folder).Labels[TerminatingLabel])
	})

	t.Run("no update when finalizer and label already present", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{CascadeDeleteFinalizer},
			Labels:     map[string]string{TerminatingLabel: TerminatingLabelValue},
		}}}

		require.NoError(t, ensureTerminationMetadata(context.Background(), store, "f"))

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

		require.NoError(t, ensureTerminationMetadata(context.Background(), store, "f"))

		require.Zero(t, store.updateCalls)
	})

	t.Run("propagates a get error", func(t *testing.T) {
		store := &fakeFolderStore{getErr: errors.New("boom")}
		require.Error(t, ensureTerminationMetadata(context.Background(), store, "f"))
	})
}

func TestRemoveTerminationMetadata(t *testing.T) {
	t.Run("removes the cascade finalizer and terminating label", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{CascadeDeleteFinalizer, "other.io/keep"},
			Labels:     map[string]string{TerminatingLabel: TerminatingLabelValue, "keep": "yes"},
		}}}

		require.NoError(t, removeTerminationMetadata(context.Background(), store, "f"))

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

		require.NoError(t, removeTerminationMetadata(context.Background(), store, "f"))

		require.Equal(t, 1, store.updateCalls)
		require.NotContains(t, store.obj.(*foldersv1.Folder).Labels, TerminatingLabel)
	})

	t.Run("no update when neither finalizer nor label is present", func(t *testing.T) {
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:       "f",
			Finalizers: []string{"other.io/keep"},
		}}}

		require.NoError(t, removeTerminationMetadata(context.Background(), store, "f"))

		require.Zero(t, store.updateCalls)
	})

	t.Run("propagates a get error", func(t *testing.T) {
		store := &fakeFolderStore{getErr: errors.New("boom")}
		require.Error(t, removeTerminationMetadata(context.Background(), store, "f"))
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
