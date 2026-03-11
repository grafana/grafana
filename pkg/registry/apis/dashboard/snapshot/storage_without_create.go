package snapshot

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
)

// storageWrapper wraps a rest.Storage and hides the not supported interfaces
// like create, update, and collection delete so the standard K8s endpoints are
// not registered. Snapshot creation is only allowed through the custom
// snapshots/create subresource route.
// It also strips the deleteKey and dashboard from GET/LIST responses so that it is not
// exposed to users with read-only access. The deleteKey is only available
// via the dedicated /snapshots/{name}/deletekey subresource and the dashboard
// via the dedicated /snapshots/{name}/dashboard subresource
type storageWrapper struct {
	inner rest.Storage
}

var (
	_ rest.Storage              = (*storageWrapper)(nil)
	_ rest.Scoper               = (*storageWrapper)(nil)
	_ rest.SingularNameProvider = (*storageWrapper)(nil)
	_ rest.Getter               = (*storageWrapper)(nil)
	_ rest.Lister               = (*storageWrapper)(nil)
	_ rest.GracefulDeleter      = (*storageWrapper)(nil)
	_ rest.TableConvertor       = (*storageWrapper)(nil)
)

// NewStorageWrapper wraps a storage to hide the rest.Creater interface.
func NewStorageWrapper(s rest.Storage) rest.Storage {
	return &storageWrapper{inner: s}
}

func (n *storageWrapper) New() runtime.Object   { return n.inner.New() }
func (n *storageWrapper) Destroy()              { n.inner.Destroy() }
func (n *storageWrapper) NamespaceScoped() bool { return n.inner.(rest.Scoper).NamespaceScoped() }
func (n *storageWrapper) GetSingularName() string {
	return n.inner.(rest.SingularNameProvider).GetSingularName()
}
func (n *storageWrapper) NewList() runtime.Object { return n.inner.(rest.Lister).NewList() }
func (n *storageWrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return n.inner.(rest.TableConvertor).ConvertToTable(ctx, object, tableOptions)
}
func (n *storageWrapper) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	obj, err := n.inner.(rest.Getter).Get(ctx, name, options)
	if err != nil {
		return nil, err
	}
	return stripSensitiveFields(obj), nil
}
func (n *storageWrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := n.inner.(rest.Lister).List(ctx, options)
	if err != nil {
		return nil, err
	}
	return stripSensitiveFieldsFromList(obj), nil
}
func (n *storageWrapper) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return n.inner.(rest.GracefulDeleter).Delete(ctx, name, deleteValidation, options)
}

// stripSensitiveFields returns a copy of the Snapshot with deleteKey and dashboard removed from the spec.
func stripSensitiveFields(obj runtime.Object) runtime.Object {
	snap, ok := obj.(*dashv0.Snapshot)
	if !ok {
		return obj
	}
	out := snap.DeepCopy()
	out.Spec.DeleteKey = nil
	out.Spec.Dashboard = nil
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
