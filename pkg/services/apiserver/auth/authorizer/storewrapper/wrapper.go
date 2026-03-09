package storewrapper

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	k8srest "k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
)

var (
	ErrUnauthenticated = errors.NewUnauthorized("unauthenticated")
	ErrUnauthorized    = errors.NewUnauthorized("unauthorized")
	ErrUnexpectedType  = errors.NewBadRequest("unexpected object type")
)

// ResourceStorageAuthorizer defines authorization hooks for resource storage operations.
type ResourceStorageAuthorizer interface {
	BeforeCreate(ctx context.Context, obj runtime.Object) error
	BeforeUpdate(ctx context.Context, obj runtime.Object) error
	BeforeDelete(ctx context.Context, obj runtime.Object) error
	AfterGet(ctx context.Context, obj runtime.Object) error
	FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error)
}

// Wrapper is a k8sStorage (e.g. registry.Store) wrapper that enforces authorization based on ResourceStorageAuthorizer.
// By default it overrides the identity in the context to use service identity for the underlying store operations.
// That way, the underlying store authorization is always successful, and the authorization is enforced by the wrapper.
// Use WithPreserveIdentity() to pass the original caller identity through to the inner store instead.
type Wrapper struct {
	inner            K8sStorage
	authorizer       ResourceStorageAuthorizer
	preserveIdentity bool
}

// Option configures a Wrapper.
type Option func(*Wrapper)

// WithPreserveIdentity instructs the Wrapper to leave the caller's identity in the context when
// calling the inner store, instead of replacing it with a service identity. Use this when the inner
// store does not perform its own RBAC checks and the caller's identity is needed downstream
// (e.g. for admission webhooks).
func WithPreserveIdentity() Option {
	return func(w *Wrapper) {
		w.preserveIdentity = true
	}
}

type K8sStorage interface {
	k8srest.Storage
	k8srest.Scoper
	k8srest.SingularNameProvider
	k8srest.Lister
	k8srest.Getter
	k8srest.CreaterUpdater
	k8srest.GracefulDeleter
}

var _ rest.Storage = (*Wrapper)(nil)
var _ k8srest.Watcher = (*Wrapper)(nil)

func New(store K8sStorage, authz ResourceStorageAuthorizer, opts ...Option) *Wrapper {
	w := &Wrapper{inner: store, authorizer: authz}
	for _, opt := range opts {
		opt(w)
	}
	return w
}

// innerCtx returns the context to use for inner store calls.
// When preserveIdentity is true the original caller context is returned unchanged;
// otherwise a service identity is injected so the inner store's own authz always succeeds.
func (w *Wrapper) innerCtx(ctx context.Context) context.Context {
	if w.preserveIdentity {
		return ctx
	}
	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	return srvCtx
}

func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metaV1.Table, error) {
	return w.inner.ConvertToTable(ctx, object, tableOptions)
}

func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *metaV1.CreateOptions) (runtime.Object, error) {
	// Enforce authorization based on the user permissions before creating the object
	err := w.authorizer.BeforeCreate(ctx, obj)
	if err != nil {
		return nil, err
	}

	return w.inner.Create(w.innerCtx(ctx), obj, createValidation, options)
}

func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (runtime.Object, bool, error) {
	// Fetch the object first to authorize
	innerCtx := w.innerCtx(ctx)
	getOpts := &metaV1.GetOptions{TypeMeta: options.TypeMeta}
	if options.Preconditions != nil {
		getOpts.ResourceVersion = *options.Preconditions.ResourceVersion
	}
	obj, err := w.inner.Get(innerCtx, name, getOpts)
	if err != nil {
		return nil, false, err
	}

	// Enforce authorization based on the user permissions
	if err := w.authorizer.BeforeDelete(ctx, obj); err != nil {
		return nil, false, err
	}

	return w.inner.Delete(innerCtx, name, deleteValidation, options)
}

func (w *Wrapper) DeleteCollection(ctx context.Context, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	// DeleteCollection is complex to authorize properly
	// For now, deny it entirely for safety
	return nil, fmt.Errorf("bulk delete operations are not supported through this API")
}

func (w *Wrapper) Destroy() {
	w.inner.Destroy()
}

func (w *Wrapper) Get(ctx context.Context, name string, options *metaV1.GetOptions) (runtime.Object, error) {
	item, err := w.inner.Get(w.innerCtx(ctx), name, options)
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

func (w *Wrapper) GetSingularName() string {
	return w.inner.GetSingularName()
}

func (w *Wrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	list, err := w.inner.List(w.innerCtx(ctx), options)
	if err != nil {
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the list
	return w.authorizer.FilterList(ctx, list)
}

func (w *Wrapper) NamespaceScoped() bool {
	return w.inner.NamespaceScoped()
}

func (w *Wrapper) New() runtime.Object {
	return w.inner.New()
}

func (w *Wrapper) NewList() runtime.Object {
	return w.inner.NewList()
}

func (w *Wrapper) Update(
	ctx context.Context,
	name string,
	objInfo k8srest.UpdatedObjectInfo,
	createValidation k8srest.ValidateObjectFunc,
	updateValidation k8srest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metaV1.UpdateOptions,
) (runtime.Object, bool, error) {
	// Create a wrapper around UpdatedObjectInfo to inject authorization
	wrappedObjInfo := &authorizedUpdateInfo{
		inner:      objInfo,
		authorizer: w.authorizer,
		userCtx:    ctx, // Keep original context for authorization
	}

	return w.inner.Update(w.innerCtx(ctx), name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
}

type authorizedUpdateInfo struct {
	inner      k8srest.UpdatedObjectInfo
	authorizer ResourceStorageAuthorizer
	userCtx    context.Context
}

func (a *authorizedUpdateInfo) Preconditions() *metaV1.Preconditions {
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

func (w *Wrapper) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	if watcher, ok := w.inner.(k8srest.Watcher); ok {
		return watcher.Watch(w.innerCtx(ctx), options)
	}
	return nil, fmt.Errorf("watch is not supported on the underlying storage")
}

// NoopAuthorizer is a no-op implementation of ResourceStorageAuthorizer.
// Use this when authorization is handled at the API level and no additional
// storage-level authorization is needed.
// This will be used if a service wants to tackle Cluster-scoped resources.
type NoopAuthorizer struct{}

func (b *NoopAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	return list, nil
}

// DenyAuthorizer denies all storage operations.
// Use this as a safe default when no explicit authorizer is provided
// for cluster-scoped resources. This ensures fail-closed behavior.
type DenyAuthorizer struct{}

func (d *DenyAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	return ErrUnauthorized
}

func (d *DenyAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	return nil, ErrUnauthorized
}
