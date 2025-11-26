package storewrapper

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

type ResourceStorageAuthorizer interface {
	BeforeCreate(ctx context.Context, obj runtime.Object) error
	BeforeUpdate(ctx context.Context, obj runtime.Object) error
	BeforeDelete(ctx context.Context, obj runtime.Object) error
	AfterGet(ctx context.Context, obj runtime.Object) error
	FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error)
}

type Wrapper struct {
	inner      *registry.Store
	authorizer ResourceStorageAuthorizer
}

var _ rest.Storage = (*Wrapper)(nil)

func New(store *registry.Store, authz ResourceStorageAuthorizer) *Wrapper {
	return &Wrapper{inner: store, authorizer: authz}
}

// ConvertToTable implements rest.Storage.
func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*v1.Table, error) {
	return w.inner.ConvertToTable(ctx, object, tableOptions)
}

// Create implements rest.Storage.
func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *v1.CreateOptions) (runtime.Object, error) {
	// Enforce authorization based on the user permissions before creating the object
	err := w.authorizer.BeforeCreate(ctx, obj)
	if err != nil {
		return nil, err
	}
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	return w.inner.Create(srvCtx, obj, createValidation, options)
}

// Delete implements rest.Storage.
func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *v1.DeleteOptions) (runtime.Object, bool, error) {
	// Enforce authorization based on the user permissions before deleting the object
	err := w.authorizer.BeforeDelete(ctx, nil)
	if err != nil {
		return nil, false, err
	}
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	return w.inner.Delete(srvCtx, name, deleteValidation, options)
}

// DeleteCollection implements rest.Storage.
func (w *Wrapper) DeleteCollection(ctx context.Context, deleteValidation k8srest.ValidateObjectFunc, options *v1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return w.inner.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

// Destroy implements rest.Storage.
func (w *Wrapper) Destroy() {
	w.inner.Destroy()
}

// Get implements rest.Storage.
func (w *Wrapper) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	item, err := w.inner.Get(srvCtx, name, options)
	if err != nil {
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the object
	err = w.authorizer.AfterGet(ctx, item)
	if err != nil {
		return nil, err
	}
	return item, nil
}

// GetSingularName implements rest.Storage.
func (w *Wrapper) GetSingularName() string {
	return w.inner.GetSingularName()
}

// List implements rest.Storage.
func (w *Wrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	list, err := w.inner.List(srvCtx, options)
	if err != nil {
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the list
	return w.authorizer.FilterList(ctx, list)
}

// NamespaceScoped implements rest.Storage.
func (w *Wrapper) NamespaceScoped() bool {
	return w.inner.NamespaceScoped()
}

// New implements rest.Storage.
func (w *Wrapper) New() runtime.Object {
	return w.inner.New()
}

// NewList implements rest.Storage.
func (w *Wrapper) NewList() runtime.Object {
	return w.inner.NewList()
}

// Update implements rest.Storage.
func (w *Wrapper) Update(
	ctx context.Context,
	name string,
	objInfo k8srest.UpdatedObjectInfo,
	createValidation k8srest.ValidateObjectFunc,
	updateValidation k8srest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *v1.UpdateOptions,
) (runtime.Object, bool, error) {
	// Create a wrapper around UpdatedObjectInfo to inject authorization
	wrappedObjInfo := &authorizedUpdateInfo{
		inner:      objInfo,
		authorizer: w.authorizer,
		userCtx:    ctx, // Keep original context for authorization
	}

	// Override the identity to use service identity for the underlying store operation
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)

	return w.inner.Update(srvCtx, name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
}

type authorizedUpdateInfo struct {
	inner      k8srest.UpdatedObjectInfo
	authorizer ResourceStorageAuthorizer
	userCtx    context.Context
}

func (a *authorizedUpdateInfo) Preconditions() *v1.Preconditions {
	return a.inner.Preconditions()
}

func (a *authorizedUpdateInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	// Get the updated object
	updatedObj, err := a.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}

	// Enforce authorization using the original user context
	if err := a.authorizer.BeforeUpdate(a.userCtx, updatedObj); err != nil {
		return nil, err
	}

	return updatedObj, nil
}
