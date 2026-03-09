package snapshot

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
)

// storageWithoutCreate wraps a rest.Storage and hides the rest.Creater interface
// so the standard K8s POST endpoint is not registered. Snapshot creation is
// only allowed through the custom /snapshots/create subresource route.
// It also strips the deleteKey from GET/LIST responses so that it is not
// exposed to users with read-only access. The deleteKey is only available
// via the dedicated /snapshots/{name}/deletekey subresource.
type storageWithoutCreate struct {
	inner rest.Storage
}

var (
	_ rest.Storage              = (*storageWithoutCreate)(nil)
	_ rest.Scoper               = (*storageWithoutCreate)(nil)
	_ rest.SingularNameProvider = (*storageWithoutCreate)(nil)
	_ rest.Getter               = (*storageWithoutCreate)(nil)
	_ rest.Lister               = (*storageWithoutCreate)(nil)
	_ rest.Updater              = (*storageWithoutCreate)(nil)
	_ rest.GracefulDeleter      = (*storageWithoutCreate)(nil)
	_ rest.CollectionDeleter    = (*storageWithoutCreate)(nil)
	_ rest.TableConvertor       = (*storageWithoutCreate)(nil)
)

// NewStorageWithoutCreate wraps a storage to hide the rest.Creater interface.
func NewStorageWithoutCreate(s rest.Storage) rest.Storage {
	return &storageWithoutCreate{inner: s}
}

func (n *storageWithoutCreate) New() runtime.Object   { return n.inner.New() }
func (n *storageWithoutCreate) Destroy()              { n.inner.Destroy() }
func (n *storageWithoutCreate) NamespaceScoped() bool { return n.inner.(rest.Scoper).NamespaceScoped() }
func (n *storageWithoutCreate) GetSingularName() string {
	return n.inner.(rest.SingularNameProvider).GetSingularName()
}
func (n *storageWithoutCreate) NewList() runtime.Object { return n.inner.(rest.Lister).NewList() }
func (n *storageWithoutCreate) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return n.inner.(rest.TableConvertor).ConvertToTable(ctx, object, tableOptions)
}
func (n *storageWithoutCreate) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := n.inner.(rest.Getter).Get(ctx, name, options)
	if err != nil {
		return nil, err
	}
	return stripDeleteKey(obj), nil
}
func (n *storageWithoutCreate) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := n.inner.(rest.Lister).List(ctx, options)
	if err != nil {
		return nil, err
	}
	return stripSensitiveFieldsFromList(obj), nil
}
func (n *storageWithoutCreate) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return n.inner.(rest.Updater).Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}
func (n *storageWithoutCreate) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return n.inner.(rest.GracefulDeleter).Delete(ctx, name, deleteValidation, options)
}
func (n *storageWithoutCreate) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return n.inner.(rest.CollectionDeleter).DeleteCollection(ctx, deleteValidation, options, listOptions)
}

// stripDeleteKey returns a copy of the Snapshot with deleteKey removed from the spec.
func stripDeleteKey(obj runtime.Object) runtime.Object {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return obj
	}
	out := snap.DeepCopy()
	out.Spec.DeleteKey = nil
	return out
}

// stripSensitiveFieldsFromList returns a copy of the SnapshotList with deleteKey and dashboard
// removed from each item's spec. The dashboard payload can be large and is not needed when listing.
func stripSensitiveFieldsFromList(obj runtime.Object) runtime.Object {
	list, ok := obj.(*dashv0.SnapshotList)
	if !ok {
		return obj
	}
	out := list.DeepCopy()
	for i := range out.Items {
		out.Items[i].Spec.DeleteKey = nil
		out.Items[i].Spec.Dashboard = nil
	}
	return out
}
