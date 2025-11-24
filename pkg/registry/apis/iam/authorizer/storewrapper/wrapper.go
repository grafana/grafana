package storewrapper

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	k8srest "k8s.io/apiserver/pkg/registry/rest"
)

// The wrapper aims to authorize access based on a target resource. Hence it needs:
// - to check the user access before requesting the underlying store
//   (except for list, which is filtered afterwards)
//   - extract the target resource from the object being created/updated
//   - query the resource to get its parent
//   - check access on the target and parent resources
// - to switch the identity (since the user will never be allowed by the underlying store)

type Wrapper struct {
	store        *registry.Store
	accessClient types.AccessClient
}

var _ rest.Storage = (*Wrapper)(nil)

func New(store *registry.Store, accessClient types.AccessClient) *Wrapper {
	return &Wrapper{store: store, accessClient: accessClient}
}

// ConvertToTable implements rest.Storage.
func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*v1.Table, error) {
	return w.store.ConvertToTable(ctx, object, tableOptions)
}

// Create implements rest.Storage.
func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *v1.CreateOptions) (runtime.Object, error) {
	return w.store.Create(ctx, obj, createValidation, options)
}

// Delete implements rest.Storage.
func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *v1.DeleteOptions) (runtime.Object, bool, error) {
	return w.store.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection implements rest.Storage.
func (w *Wrapper) DeleteCollection(ctx context.Context, deleteValidation k8srest.ValidateObjectFunc, options *v1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return w.store.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

// Destroy implements rest.Storage.
func (w *Wrapper) Destroy() {
	w.store.Destroy()
}

// Get implements rest.Storage.
func (w *Wrapper) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	return w.store.Get(ctx, name, options)
}

// GetSingularName implements rest.Storage.
func (w *Wrapper) GetSingularName() string {
	return w.store.GetSingularName()
}

// List implements rest.Storage.
func (w *Wrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return w.store.List(ctx, options)
}

// NamespaceScoped implements rest.Storage.
func (w *Wrapper) NamespaceScoped() bool {
	return w.store.NamespaceScoped()
}

// New implements rest.Storage.
func (w *Wrapper) New() runtime.Object {
	return w.store.New()
}

// NewList implements rest.Storage.
func (w *Wrapper) NewList() runtime.Object {
	return w.store.NewList()
}

// Update implements rest.Storage.
func (w *Wrapper) Update(ctx context.Context, name string, objInfo k8srest.UpdatedObjectInfo, createValidation k8srest.ValidateObjectFunc, updateValidation k8srest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *v1.UpdateOptions) (runtime.Object, bool, error) {
	return w.store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}
