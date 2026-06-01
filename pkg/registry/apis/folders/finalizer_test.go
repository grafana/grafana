package folders

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
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

	t.Run("no update when the folder is already terminating", func(t *testing.T) {
		now := metav1.NewTime(time.Now())
		store := &fakeFolderStore{obj: &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:              "f",
			DeletionTimestamp: &now,
		}}}

		require.NoError(t, ensureTerminationMetadata(context.Background(), store, "f"))

		require.Zero(t, store.updateCalls)
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

	t.Run("propagates a get error", func(t *testing.T) {
		store := &fakeFolderStore{getErr: errors.New("boom")}
		require.Error(t, ensureTerminationMetadata(context.Background(), store, "f"))
	})
}
