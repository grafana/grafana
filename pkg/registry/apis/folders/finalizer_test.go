package folders

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
