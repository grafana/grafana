package storewrapper

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

const tracerName = "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"

// ResourceStorageAuthorizer defines authorization hooks for resource storage operations.
type ResourceStorageAuthorizer interface {
	BeforeCreate(ctx context.Context, obj runtime.Object) error
	BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error
	BeforeDelete(ctx context.Context, obj runtime.Object) error
	AfterGet(ctx context.Context, obj runtime.Object) error
	FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error)
}

// Layer constants distinguish the two timing slices the wrapper records.
// Consumers map these to whatever histogram label scheme they want.
const (
	LayerAuthz = "authz" // Authorization hook (BeforeCreate, BeforeUpdate, BeforeDelete, AfterGet, FilterList).
	LayerInner = "inner" // Inner store call (Create, Get, List, Update, Delete, Watch).
)

// Observer records wrapper latency for authorization hooks and inner store calls.
type Observer interface {
	Observe(layer, op string, resource schema.GroupResource, dur time.Duration, status string)
}

type noopObserver struct{}

func (noopObserver) Observe(string, string, schema.GroupResource, time.Duration, string) {}

// Wrapper is a k8sStorage (e.g. registry.Store) wrapper that enforces authorization based on ResourceStorageAuthorizer.
// It overrides the identity in the context to use service identity for the underlying store operations so the
// store's authorization always succeeds and the wrapper enforces authorization. The wrapper injects the original
// user's UID as metadata identity so unistore can set createdBy/updatedBy correctly (see identity.WithOriginalIdentityUID).
// The wrapper also supports an option to preserve the original caller's identity in the context for inner store calls instead of replacing it with a service identity.
// Use this when the inner store does not perform its own RBAC checks and the caller's identity is needed downstream (e.g. for admission webhooks).
type Wrapper struct {
	inner            K8sStorage
	authorizer       ResourceStorageAuthorizer
	preserveIdentity bool
	tracer           trace.Tracer
	observer         Observer
	resource         schema.GroupResource
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

// WithTracer configures tracing for wrapper operations.
func WithTracer(t trace.Tracer) Option {
	return func(w *Wrapper) {
		if t != nil {
			w.tracer = t
		}
	}
}

// WithObserver configures metrics observation for wrapper operations.
func WithObserver(observer Observer) Option {
	return func(w *Wrapper) {
		if observer != nil {
			w.observer = observer
		}
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

// New returns a Wrapper that enforces authorization and uses service identity for inner store calls,
// injecting the original user's UID for createdBy/updatedBy annotations.
func New(store K8sStorage, resource schema.GroupResource, authz ResourceStorageAuthorizer, opts ...Option) *Wrapper {
	w := &Wrapper{
		inner:      store,
		authorizer: authz,
		resource:   resource,
		tracer:     noop.NewTracerProvider().Tracer(tracerName),
		observer:   noopObserver{},
	}
	for _, opt := range opts {
		opt(w)
	}
	return w
}

// storeCtx returns the context for inner store calls: service identity so the store's authorization
// succeeds, with the original user's UID injected as metadata identity for createdBy/updatedBy (see identity.WithOriginalIdentityUID).
// When preserveIdentity is true the original caller context is returned unchanged;
func (w *Wrapper) storeCtx(ctx context.Context) context.Context {
	if w.preserveIdentity {
		return ctx
	}

	srvCtx, _ := identity.WithServiceIdentity(ctx, 0)
	if user, err := identity.GetRequester(ctx); err == nil && user.GetUID() != "" {
		srvCtx = identity.WithOriginalIdentityUID(srvCtx, user.GetUID())
	}

	return srvCtx
}

func (w *Wrapper) startSpan(ctx context.Context, method string) (context.Context, trace.Span) {
	return w.tracer.Start(ctx, "authz.storewrapper."+method, trace.WithAttributes(
		attribute.String("resource.group", w.resource.Group),
		attribute.String("resource.resource", w.resource.Resource),
	))
}

func (w *Wrapper) observeAuthz(op string, start time.Time, err error) {
	w.observer.Observe(LayerAuthz, op, w.resource, time.Since(start), statusFromError(err))
}

func (w *Wrapper) observeInner(op string, start time.Time, err error) {
	w.observer.Observe(LayerInner, op, w.resource, time.Since(start), statusFromError(err))
}

func recordSpanError(span trace.Span, err error) {
	if err == nil {
		return
	}
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

func statusFromError(err error) string {
	if err == nil {
		return "success"
	}
	if errors.IsForbidden(err) {
		return "forbidden"
	}
	if errors.IsUnauthorized(err) {
		return "unauthorized"
	}
	if errors.IsNotFound(err) {
		return "not_found"
	}
	if errors.IsMethodNotSupported(err) {
		return "method_not_supported"
	}
	if errors.IsBadRequest(err) {
		return "bad_request"
	}
	return "error"
}

func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metaV1.Table, error) {
	return w.inner.ConvertToTable(ctx, object, tableOptions)
}

func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *metaV1.CreateOptions) (runtime.Object, error) {
	ctx, span := w.startSpan(ctx, "Create")
	defer span.End()

	// Enforce authorization based on the user permissions before creating the object
	authzStart := time.Now()
	err := w.authorizer.BeforeCreate(ctx, obj)
	w.observeAuthz("before_create", authzStart, err)
	if err != nil {
		recordSpanError(span, err)
		return nil, err
	}

	innerStart := time.Now()
	result, err := w.inner.Create(w.storeCtx(ctx), obj, createValidation, options)
	w.observeInner("create", innerStart, err)
	recordSpanError(span, err)
	return result, err
}

func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (runtime.Object, bool, error) {
	ctx, span := w.startSpan(ctx, "Delete")
	defer span.End()

	// Fetch the object first to authorize
	storeCtx := w.storeCtx(ctx)
	getOpts := &metaV1.GetOptions{TypeMeta: options.TypeMeta}
	if options.Preconditions != nil {
		getOpts.ResourceVersion = *options.Preconditions.ResourceVersion
	}
	innerGetStart := time.Now()
	obj, err := w.inner.Get(storeCtx, name, getOpts)
	w.observeInner("delete_get", innerGetStart, err)
	if err != nil {
		recordSpanError(span, err)
		return nil, false, err
	}

	// Enforce authorization based on the user permissions
	authzStart := time.Now()
	if err := w.authorizer.BeforeDelete(ctx, obj); err != nil {
		w.observeAuthz("before_delete", authzStart, err)
		recordSpanError(span, err)
		return nil, false, err
	}
	w.observeAuthz("before_delete", authzStart, nil)

	innerStart := time.Now()
	result, deleted, err := w.inner.Delete(storeCtx, name, deleteValidation, options)
	w.observeInner("delete", innerStart, err)
	recordSpanError(span, err)
	return result, deleted, err
}

func (w *Wrapper) DeleteCollection(ctx context.Context, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	ctx, span := w.startSpan(ctx, "DeleteCollection")
	defer span.End()

	// DeleteCollection is complex to authorize properly; deny it entirely for safety
	err := errors.NewMethodNotSupported(w.resource, "deleteCollection")
	w.observeInner("delete_collection", time.Now(), err)
	recordSpanError(span, err)
	return nil, err
}

func (w *Wrapper) Destroy() {
	w.inner.Destroy()
}

func (w *Wrapper) Get(ctx context.Context, name string, options *metaV1.GetOptions) (runtime.Object, error) {
	ctx, span := w.startSpan(ctx, "Get")
	defer span.End()

	innerStart := time.Now()
	item, err := w.inner.Get(w.storeCtx(ctx), name, options)
	w.observeInner("get", innerStart, err)
	if err != nil {
		recordSpanError(span, err)
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the object
	authzStart := time.Now()
	err = w.authorizer.AfterGet(ctx, item)
	w.observeAuthz("after_get", authzStart, err)
	if err != nil {
		recordSpanError(span, err)
		return nil, err
	}
	return item, nil
}

func (w *Wrapper) GetSingularName() string {
	return w.inner.GetSingularName()
}

func (w *Wrapper) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ctx, span := w.startSpan(ctx, "List")
	defer span.End()

	innerStart := time.Now()
	list, err := w.inner.List(w.storeCtx(ctx), options)
	w.observeInner("list", innerStart, err)
	if err != nil {
		recordSpanError(span, err)
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the list
	authzStart := time.Now()
	result, err := w.authorizer.FilterList(ctx, list)
	w.observeAuthz("filter_list", authzStart, err)
	recordSpanError(span, err)
	return result, err
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
	ctx, span := w.startSpan(ctx, "Update")
	defer span.End()

	// Create a wrapper around UpdatedObjectInfo to inject authorization
	wrappedObjInfo := &authorizedUpdateInfo{
		inner:      objInfo,
		authorizer: w.authorizer,
		userCtx:    ctx, // Keep original context for authorization
		tracer:     w.tracer,
		observer:   w.observer,
		resource:   w.resource,
	}

	innerStart := time.Now()
	result, updated, err := w.inner.Update(w.storeCtx(ctx), name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
	w.observeInner("update", innerStart, err)
	recordSpanError(span, err)
	return result, updated, err
}

type authorizedUpdateInfo struct {
	inner      k8srest.UpdatedObjectInfo
	authorizer ResourceStorageAuthorizer
	userCtx    context.Context
	tracer     trace.Tracer
	observer   Observer
	resource   schema.GroupResource
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
	authzCtx, span := a.tracer.Start(a.userCtx, "iam.storewrapper.UpdateAuthz", trace.WithAttributes(
		attribute.String("resource.group", a.resource.Group),
		attribute.String("resource.resource", a.resource.Resource),
	))
	defer span.End()

	authzStart := time.Now()
	if err := a.authorizer.BeforeUpdate(authzCtx, oldObj, updatedObj); err != nil {
		a.observer.Observe(LayerAuthz, "before_update", a.resource, time.Since(authzStart), statusFromError(err))
		recordSpanError(span, err)
		return nil, err
	}
	a.observer.Observe(LayerAuthz, "before_update", a.resource, time.Since(authzStart), "success")

	return updatedObj, nil
}

func (w *Wrapper) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	ctx, span := w.startSpan(ctx, "Watch")
	defer span.End()

	if watcher, ok := w.inner.(k8srest.Watcher); ok {
		innerStart := time.Now()
		result, err := watcher.Watch(w.storeCtx(ctx), options)
		w.observeInner("watch", innerStart, err)
		recordSpanError(span, err)
		return result, err
	}
	err := fmt.Errorf("watch is not supported on the underlying storage")
	w.observeInner("watch", time.Now(), err)
	recordSpanError(span, err)
	return nil, err
}

// NoopAuthorizer is a no-op implementation of ResourceStorageAuthorizer.
// Use this when authorization is handled at the API level and no additional
// storage-level authorization is needed.
// This will be used if a service wants to tackle Cluster-scoped resources.
type NoopAuthorizer struct{}

func (b *NoopAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return nil
}

func (b *NoopAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
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

func (d *DenyAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
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
