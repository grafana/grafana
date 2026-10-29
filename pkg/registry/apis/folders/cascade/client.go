package cascade

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// DynamicClients deletes children and writes folder state through the apiservers, so hooks and
// admission run exactly as for any other client. It works the same in-process and in an operator.
type DynamicClients struct {
	client dynamic.Interface
}

var (
	_ ChildDeleter = (*DynamicClients)(nil)
	_ FolderWriter = (*DynamicClients)(nil)
	_ FolderGetter = (*DynamicClients)(nil)
)

func NewDynamicClients(client dynamic.Interface) *DynamicClients {
	return &DynamicClients{client: client}
}

func (d *DynamicClients) Get(ctx context.Context, namespace, name string) (*foldersv1.Folder, error) {
	u, err := d.client.Resource(folderGVR).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	f := &foldersv1.Folder{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, f); err != nil {
		return nil, fmt.Errorf("convert folder %s/%s: %w", namespace, name, err)
	}
	return f, nil
}

func (d *DynamicClients) Delete(ctx context.Context, namespace, parentUID string, child Child) (DeleteOutcome, error) {
	switch child.Kind {
	case ChildDashboard:
		return d.deleteChild(ctx, d.client.Resource(dashboardGVR).Namespace(namespace), parentUID, child.Name)
	case ChildFolder:
		return d.deleteChild(ctx, d.client.Resource(folderGVR).Namespace(namespace), parentUID, child.Name)
	default:
		return 0, fmt.Errorf("unsupported child kind %q", child.Kind)
	}
}

// deleteChild re-reads the child rather than trusting the search hit: the index can lag a move, and
// deleting by name alone would then remove the child (and, for a folder, its subtree) from the folder
// it moved to. The uid and resourceVersion preconditions make the delete fail instead of acting on a
// child that was recreated or moved between this read and the delete. Terminating children are
// skipped, since re-deleting them would only spend a batch slot.
//
// Deletes are forced (gracePeriodSeconds=0), as the synchronous cascade does: it gets a non-empty
// subfolder past the emptiness check (with the cascade finalizer it only goes terminating and runs
// its own cascade), and a file-provisioned dashboard past the check that otherwise rejects deleting
// it, which would leave the folder stuck.
func (d *DynamicClients) deleteChild(ctx context.Context, client dynamic.ResourceInterface, parentUID, name string) (DeleteOutcome, error) {
	existing, err := client.Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return DeleteOutcomeGone, nil
	}
	if err != nil {
		return 0, err
	}
	if existing.GetAnnotations()[utils.AnnoKeyFolder] != parentUID {
		return DeleteOutcomeGone, nil
	}
	if existing.GetDeletionTimestamp() != nil {
		return DeleteOutcomeTerminating, nil
	}

	uid, rv := existing.GetUID(), existing.GetResourceVersion()
	zero := int64(0)
	err = client.Delete(ctx, name, metav1.DeleteOptions{
		GracePeriodSeconds: &zero,
		Preconditions:      &metav1.Preconditions{UID: &uid, ResourceVersion: &rv},
	})
	if apierrors.IsNotFound(err) {
		return DeleteOutcomeGone, nil
	}
	if err != nil {
		return 0, err
	}
	if len(existing.GetFinalizers()) > 0 {
		return DeleteOutcomePending, nil
	}
	return DeleteOutcomeDeleted, nil
}

// UpdateCascadeStatus merge-patches status.cascadeDelete. Unset fields are sent as null, since a
// merge patch otherwise keeps their old values (e.g. errors from an earlier failed pass).
func (d *DynamicClients) UpdateCascadeStatus(ctx context.Context, namespace, name string, status foldersv1.FolderCascadeDeleteStatus) error {
	cascade := map[string]any{
		"state":     status.State,
		"total":     status.Total,
		"remaining": status.Remaining,
		"errors":    status.Errors,
		"started":   status.Started,
		"finished":  status.Finished,
	}
	if len(status.Errors) == 0 {
		cascade["errors"] = nil
	}
	patch, err := json.Marshal(map[string]any{"status": map[string]any{"cascadeDelete": cascade}})
	if err != nil {
		return err
	}
	_, err = d.client.Resource(folderGVR).Namespace(namespace).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
	return err
}

// RemoveFinalizer removes only the cascade finalizer. The test op pins the entry's position, so a
// concurrent change to the finalizer list fails the patch instead of removing someone else's entry.
func (d *DynamicClients) RemoveFinalizer(ctx context.Context, namespace, name string, finalizers []string) error {
	idx := slices.Index(finalizers, foldersv1.CascadeDeleteFinalizer)
	if idx < 0 {
		return nil
	}
	path := fmt.Sprintf("/metadata/finalizers/%d", idx)
	patch, err := json.Marshal([]map[string]any{
		{"op": "test", "path": path, "value": foldersv1.CascadeDeleteFinalizer},
		{"op": "remove", "path": path},
	})
	if err != nil {
		return err
	}
	_, err = d.client.Resource(folderGVR).Namespace(namespace).Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{})
	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}
