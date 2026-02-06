package snapshot

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// storageWithoutCreate wraps a rest.Storage and hides the rest.Creater interface
// so the standard K8s POST endpoint is not registered. Snapshot creation is
// only allowed through the custom /snapshots/create subresource route.
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
	return n.inner.(rest.Getter).Get(ctx, name, options)
}
func (n *storageWithoutCreate) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return n.inner.(rest.Lister).List(ctx, options)
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
