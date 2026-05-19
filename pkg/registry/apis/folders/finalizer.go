package folders

import (
	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// CascadeDeleteFinalizer blocks folder removal until child resources are cascade-deleted.
const CascadeDeleteFinalizer = "folder.grafana.app/cascade-delete"

func HasCascadeFinalizer(f *foldersv1.Folder) bool {
	return hasCascadeFinalizer(f.Finalizers)
}

func ensureCascadeFinalizerOnObject(f *foldersv1.Folder) {
	if f.DeletionTimestamp != nil && !f.DeletionTimestamp.IsZero() {
		return
	}
	if HasCascadeFinalizer(f) {
		return
	}
	f.Finalizers = append(f.Finalizers, CascadeDeleteFinalizer)
}
