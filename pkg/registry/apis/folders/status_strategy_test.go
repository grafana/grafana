package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

func TestFolderStatusStrategy_PrepareForUpdate(t *testing.T) {
	strategy := newFolderStatusStrategy(runtime.NewScheme(), foldersv1.FolderResourceInfo.GroupVersion())

	old := &foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Name:        "f1",
			Labels:      map[string]string{"a": "b"},
			Annotations: map[string]string{"grafana.app/folder": "parent"},
			Finalizers:  []string{foldersv1.CascadeDeleteFinalizer},
		},
		Spec: foldersv1.FolderSpec{Title: "Original", Description: new("desc")},
	}
	// Mirrors what the generated FolderClient.UpdateStatus sends: no spec, no labels/annotations/finalizers.
	updated := &foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{Name: "f1"},
		Status: foldersv1.FolderStatus{CascadeDelete: &foldersv1.FolderCascadeDeleteStatus{
			State: foldersv1.FolderCascadeDeleteStatusStateInProgress,
		}},
	}

	strategy.PrepareForUpdate(context.Background(), updated, old)

	require.Equal(t, old.Spec, updated.Spec)
	require.Equal(t, old.Labels, updated.Labels)
	require.Equal(t, old.Annotations, updated.Annotations)
	require.Equal(t, old.Finalizers, updated.Finalizers)
	require.Equal(t, foldersv1.FolderCascadeDeleteStatusStateInProgress, updated.Status.CascadeDelete.State)

	// The restored spec must not alias the stored object.
	*updated.Spec.Description = "changed"
	require.Equal(t, "desc", *old.Spec.Description)
}
