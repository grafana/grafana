package folders

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
)

// folderStatusStrategy is the generic status strategy plus restoring spec from the stored
// object. The generic strategy only restores metadata, so a status-only write (as sent by
// FolderClient.UpdateStatus) would otherwise wipe the title and fail folder validation.
type folderStatusStrategy struct {
	rest.UpdateResetFieldsStrategy
}

func newFolderStatusStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion) *folderStatusStrategy {
	return &folderStatusStrategy{UpdateResetFieldsStrategy: grafanaregistry.NewStatusStrategy(typer, gv)}
}

func (s *folderStatusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	s.UpdateResetFieldsStrategy.PrepareForUpdate(ctx, obj, old)

	newFolder, ok := obj.(*foldersv1.Folder)
	if !ok {
		return
	}
	oldFolder, ok := old.(*foldersv1.Folder)
	if !ok {
		return
	}
	oldFolder.Spec.DeepCopyInto(&newFolder.Spec)

	keepCascadeDeleteRequester(ctx, newFolder, oldFolder)
}

// keepCascadeDeleteRequester makes the requester server-owned: only a Grafana service identity (the
// in-process one and the provisioning one, both trusted) may record, replace or clear it, and every
// other writer gets the stored value back.
func keepCascadeDeleteRequester(ctx context.Context, newFolder, oldFolder *foldersv1.Folder) {
	if identity.IsServiceIdentity(ctx) {
		return
	}
	var stored *foldersv1.FolderCascadeDeleteStatus
	if oldFolder.Status.CascadeDelete != nil && oldFolder.Status.CascadeDelete.Requester != nil {
		stored = oldFolder.Status.CascadeDelete
	}
	switch {
	case newFolder.Status.CascadeDelete != nil:
		newFolder.Status.CascadeDelete.Requester = nil
		if stored != nil {
			restored := *stored.Requester
			newFolder.Status.CascadeDelete.Requester = &restored
		}
	case stored != nil:
		// A writer can't drop the status that holds the requester.
		restored := *stored
		newFolder.Status.CascadeDelete = &restored
	}
}
