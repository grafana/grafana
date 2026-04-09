package storewrapper

import (
	"context"
	"fmt"
	"time"

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

// WatchEventFilter is a batch filter for watch events. Given a slice of
// data-carrying events (Added, Modified, Deleted) it returns a same-length bool
// slice indicating which events to forward. Returning an error terminates the watch.
// Implementations are called from a single goroutine and need not be concurrency-safe.
type WatchEventFilter func(events []watch.Event) ([]bool, error)

// RejectAllWatchFilter is a WatchEventFilter that silently drops every event.
// Use it as a safe placeholder in WatchFilter implementations that are not yet
// complete. Individual teams are expected to replace it with proper authorization logic.
var RejectAllWatchFilter WatchEventFilter = func(events []watch.Event) ([]bool, error) {
	return make([]bool, len(events)), nil
}

// AllowAllWatchFilter is a WatchEventFilter that forwards every event unconditionally.
// Use this only for resources that impose no per-event read restrictions.
var AllowAllWatchFilter WatchEventFilter = func(events []watch.Event) ([]bool, error) {
	allowed := make([]bool, len(events))
	for i := range allowed {
		allowed[i] = true
	}
	return allowed, nil
}

// ResourceStorageAuthorizer defines authorization hooks for resource storage operations.
type ResourceStorageAuthorizer interface {
	BeforeCreate(ctx context.Context, obj runtime.Object) error
	BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error
	BeforeDelete(ctx context.Context, obj runtime.Object) error
	AfterGet(ctx context.Context, obj runtime.Object) error
	FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error)
	// WatchFilter is called once when a Watch begins. It may pre-compile authorization
	// state (e.g. fetch permissions, capture auth info) and must return a WatchEventFilter
	// that will be invoked for each flush of buffered events. Bookmark and Error events
	// always bypass the filter. Use AllowAllWatchFilter for resources with no per-event
	// read restrictions, and RejectAllWatchFilter as a safe placeholder.
	// The Wrapper's WatchFlushInterval controls how often the buffer is flushed:
	// 0 (default) flushes after every event; >0 amortizes RPC cost across bursts.
	WatchFilter(ctx context.Context) (WatchEventFilter, error)
}

// Wrapper is a k8sStorage (e.g. registry.Store) wrapper that enforces authorization based on ResourceStorageAuthorizer.
// It overrides the identity in the context to use service identity for the underlying store operations so the
// store's authorization always succeeds and the wrapper enforces authorization. The wrapper injects the original
// user's UID as metadata identity so unistore can set createdBy/updatedBy correctly (see identity.WithOriginalIdentityUID).
// The wrapper also supports an option to preserve the original caller's identity in the context for inner store calls instead of replacing it with a service identity.
// Use this when the inner store does not perform its own RBAC checks and the caller's identity is needed downstream (e.g. for admission webhooks).
type Wrapper struct {
	inner              K8sStorage
	authorizer         ResourceStorageAuthorizer
	preserveIdentity   bool
	watchFlushInterval time.Duration
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

// WithWatchFlushInterval sets how long the filteredWatcher buffers events before
// calling WatchFilter with a batch. The default (0) flushes after every individual
// event, which is safe and correct but makes one filter call per event. Set a
// positive duration (e.g. 50ms) to amortize RPC cost across bursts when the
// authorizer's WatchFilter uses BatchCheck internally.
func WithWatchFlushInterval(d time.Duration) Option {
	return func(w *Wrapper) {
		w.watchFlushInterval = d
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
func New(store K8sStorage, authz ResourceStorageAuthorizer, opts ...Option) *Wrapper {
	w := &Wrapper{inner: store, authorizer: authz}
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

func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metaV1.Table, error) {
	return w.inner.ConvertToTable(ctx, object, tableOptions)
}

func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *metaV1.CreateOptions) (runtime.Object, error) {
	// Enforce authorization based on the user permissions before creating the object
	err := w.authorizer.BeforeCreate(ctx, obj)
	if err != nil {
		return nil, err
	}

	return w.inner.Create(w.storeCtx(ctx), obj, createValidation, options)
}

func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (runtime.Object, bool, error) {
	// Fetch the object first to authorize
	storeCtx := w.storeCtx(ctx)
	getOpts := &metaV1.GetOptions{TypeMeta: options.TypeMeta}
	if options.Preconditions != nil {
		getOpts.ResourceVersion = *options.Preconditions.ResourceVersion
	}
	obj, err := w.inner.Get(storeCtx, name, getOpts)
	if err != nil {
		return nil, false, err
	}

	// Enforce authorization based on the user permissions
	if err := w.authorizer.BeforeDelete(ctx, obj); err != nil {
		return nil, false, err
	}

	return w.inner.Delete(storeCtx, name, deleteValidation, options)
}

func (w *Wrapper) DeleteCollection(ctx context.Context, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	// DeleteCollection is complex to authorize properly; deny it entirely for safety
	return nil, errors.NewMethodNotSupported(schema.GroupResource{}, "deleteCollection")
}

func (w *Wrapper) Destroy() {
	w.inner.Destroy()
}

func (w *Wrapper) Get(ctx context.Context, name string, options *metaV1.GetOptions) (runtime.Object, error) {
	item, err := w.inner.Get(w.storeCtx(ctx), name, options)
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
	list, err := w.inner.List(w.storeCtx(ctx), options)
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

	return w.inner.Update(w.storeCtx(ctx), name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
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
	if err := a.authorizer.BeforeUpdate(a.userCtx, oldObj, updatedObj); err != nil {
		return nil, err
	}

	return updatedObj, nil
}

func (w *Wrapper) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	watcher, ok := w.inner.(k8srest.Watcher)
	if !ok {
		return nil, fmt.Errorf("watch is not supported on the underlying storage")
	}

	// Build the filter once, before starting the watch, so callers get an immediate
	// error if authorization state cannot be resolved (e.g. auth backend unavailable).
	filter, err := w.authorizer.WatchFilter(ctx)
	if err != nil {
		return nil, err
	}
	// Fail-closed: a nil filter is treated as RejectAllWatchFilter.
	// Implementors should return AllowAllWatchFilter explicitly for unrestricted resources.
	if filter == nil {
		return nil, fmt.Errorf("watch requires a filter")
	}

	inner, err := watcher.Watch(w.storeCtx(ctx), options)
	if err != nil {
		return nil, err
	}
	return newFilteredWatcher(inner, filter, w.watchFlushInterval), nil
}

// filteredWatcher wraps a watch.Interface and runs the WatchEventFilter over
// buffered batches of events before forwarding them to the caller.
// Bookmark and Error events bypass the filter and are forwarded immediately.
//
// When flushInterval is 0 the buffer is flushed after every individual event
// (synchronous, no added latency). When flushInterval > 0 events are accumulated
// and flushed either when the buffer is full or the ticker fires, amortizing the
// cost of expensive filter implementations (e.g. BatchCheck RPCs) across bursts.
type filteredWatcher struct {
	inner         watch.Interface
	filter        WatchEventFilter
	flushInterval time.Duration
	result        chan watch.Event
	done          chan struct{}
}

// watchBatchSize is the maximum number of events buffered before a forced flush.
// Matches watch.DefaultChanSize so the batch can never exceed the inner channel capacity.
const watchBatchSize = 100

func newFilteredWatcher(inner watch.Interface, filter WatchEventFilter, flushInterval time.Duration) *filteredWatcher {
	fw := &filteredWatcher{
		inner:         inner,
		filter:        filter,
		flushInterval: flushInterval,
		result:        make(chan watch.Event, watch.DefaultChanSize),
		done:          make(chan struct{}),
	}
	go fw.run()
	return fw
}

func (fw *filteredWatcher) run() {
	defer close(fw.result)

	// A nil channel blocks forever in select, disabling the ticker case when
	// flushInterval is 0 (each event is flushed inline immediately instead).
	var tickerC <-chan time.Time
	if fw.flushInterval > 0 {
		t := time.NewTicker(fw.flushInterval)
		defer t.Stop()
		tickerC = t.C
	}

	var pending []watch.Event

	flush := func() {
		if len(pending) == 0 {
			return
		}
		allowed, err := fw.filter(pending)
		if err != nil {
			fw.inner.Stop()
			pending = pending[:0]
			return
		}
		for i, event := range pending {
			if i < len(allowed) && allowed[i] {
				fw.result <- event
			}
		}
		pending = pending[:0]
	}

	for {
		select {
		case <-fw.done:
			return
		case event, ok := <-fw.inner.ResultChan():
			if !ok {
				return
			}
			// Protocol events carry no resource data and must never be delayed.
			if event.Type == watch.Bookmark || event.Type == watch.Error {
				flush() // drain pending first to preserve ordering
				fw.result <- event
				continue
			}
			pending = append(pending, event)
			if fw.flushInterval == 0 || len(pending) >= watchBatchSize {
				flush()
			}
		case <-tickerC:
			flush()
		}
	}
}

func (fw *filteredWatcher) Stop() {
	close(fw.done)
	fw.inner.Stop()
}

func (fw *filteredWatcher) ResultChan() <-chan watch.Event {
	return fw.result
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

func (b *NoopAuthorizer) WatchFilter(_ context.Context) (WatchEventFilter, error) {
	return AllowAllWatchFilter, nil
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

func (d *DenyAuthorizer) WatchFilter(_ context.Context) (WatchEventFilter, error) {
	return RejectAllWatchFilter, nil
}
