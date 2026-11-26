package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

func TestFolderStatusStrategy_CascadeDeleteRequester(t *testing.T) {
	strategy := newFolderStatusStrategy(runtime.NewScheme(), foldersv1.FolderResourceInfo.GroupVersion())
	recorded := &foldersv1.FolderCascadeDeleteRequester{Sub: "user:1", Identifier: "a", Type: foldersv1.FolderCascadeDeleteRequesterTypeUser}
	forged := &foldersv1.FolderCascadeDeleteRequester{Sub: "user:2", Identifier: "b", Type: foldersv1.FolderCascadeDeleteRequesterTypeUser}

	folder := func(r *foldersv1.FolderCascadeDeleteRequester) *foldersv1.Folder {
		f := &foldersv1.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f1"}, Spec: foldersv1.FolderSpec{Title: "t"}}
		if r != nil {
			f.Status.CascadeDelete = &foldersv1.FolderCascadeDeleteStatus{Requester: r}
		}
		return f
	}
	requesterOf := func(f *foldersv1.Folder) *foldersv1.FolderCascadeDeleteRequester {
		if f.Status.CascadeDelete == nil {
			return nil
		}
		return f.Status.CascadeDelete.Requester
	}
	user := identity.WithRequester(context.Background(), &identity.StaticRequester{UserUID: "u", Type: "user"})
	service := identity.WithServiceIdentityContext(context.Background(), 1)

	tests := []struct {
		name     string
		ctx      context.Context
		old, new *foldersv1.FolderCascadeDeleteRequester
		want     *foldersv1.FolderCascadeDeleteRequester
	}{
		{"user cannot set one", user, nil, forged, nil},
		{"user cannot change it", user, recorded, forged, recorded},
		{"user cannot clear it", user, recorded, nil, recorded},
		{"service identity can set one", service, nil, recorded, recorded},
		{"service identity can replace it", service, recorded, forged, forged},
		{"service identity can clear it", service, recorded, nil, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			updated := folder(tt.new)
			strategy.PrepareForUpdate(tt.ctx, updated, folder(tt.old))
			require.Equal(t, tt.want, requesterOf(updated))
		})
	}
}

func TestFolderStatusStrategy_RestoresTheStatusHoldingTheRequester(t *testing.T) {
	strategy := newFolderStatusStrategy(runtime.NewScheme(), foldersv1.FolderResourceInfo.GroupVersion())
	requester := &foldersv1.FolderCascadeDeleteRequester{Sub: "user:1", Identifier: "a", Type: foldersv1.FolderCascadeDeleteRequesterTypeUser}
	old := &foldersv1.Folder{Status: foldersv1.FolderStatus{CascadeDelete: &foldersv1.FolderCascadeDeleteStatus{
		State: foldersv1.FolderCascadeDeleteStatusStateInProgress, Requester: requester,
	}}}
	updated := &foldersv1.Folder{}

	strategy.PrepareForUpdate(identity.WithRequester(context.Background(), &identity.StaticRequester{UserUID: "u", Type: "user"}), updated, old)

	require.Equal(t, old.Status.CascadeDelete, updated.Status.CascadeDelete)
}
