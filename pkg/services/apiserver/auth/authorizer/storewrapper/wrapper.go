package storewrapper

import (
	"context"
	"fmt"
	"reflect"
	"sync"
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

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
)

var (
	ErrUnauthenticated = errors.NewUnauthorized("unauthenticated")
	ErrUnauthorized    = errors.NewUnauthorized("unauthorized")
	ErrUnexpectedType  = errors.NewBadRequest("unexpected object type")
)

const (
	tracerName = "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"

	OpBeforeCreate      = "before_create"
	OpCreate            = "create"
	OpBeforeDelete      = "before_delete"
	OpDelete            = "delete"
	OpDeleteGet         = "delete_get"
	OpGet               = "get"
	OpList              = "list"
	OpBeforeUpdate      = "before_update"
	OpUpdate            = "update"
	OpAfterGet          = "after_get"
	OpFilterList        = "filter_list"
	OpWatchFilter       = "watch_filter"
	OpFilterWatchEvents = "filter_watch_events"
	OpSendWatchEvents   = "send_watch_events"

	defaultWatchSendTimeout = 1 * time.Second
)

// WatchEventFilter is a batch filter for watch events. Given a slice of
// data-carrying events (Added, Modified, Deleted) it returns a same-length bool
// slice indicating which events to forward. Returning an error terminates the watch.
// Implementations are called from a single goroutine and need not be concurrency-safe.
type WatchEventFilter func(events []watch.Event) ([]bool, error)

// RejectAllWatchFilter is a nil WatchEventFilter that will make watch return an error.
var RejectAllWatchFilter WatchEventFilter = nil

// PassThroughWatchFilter is used to bypass the filter and forward the inner watch.Interface directly to the caller.
var PassThroughWatchFilter WatchEventFilter = func(_ []watch.Event) ([]bool, error) {
	// The error is a safety net to prevent the filter from being used accidentally
	// silently dropping all events without returning an error.
	return nil, errors.NewUnauthorized("watch filter not implemented")
}

// isPassThroughWatchFilter returns true if the filter is the PassThroughWatchFilter.
func isPassThroughWatchFilter(filter WatchEventFilter) bool {
	if filter == nil {
		return false
	}
	return reflect.ValueOf(filter).Pointer() == reflect.ValueOf(PassThroughWatchFilter).Pointer()
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
	// always bypass the filter. Use PassThroughWatchFilter for resources with no per-event
	// read restrictions, and RejectAllWatchFilter as a safe placeholder.
	// The Wrapper's WatchFlushInterval controls how often the buffer is flushed:
	// 0 (default) flushes after every event; >0 amortizes RPC cost across bursts.
	WatchFilter(ctx context.Context) (WatchEventFilter, error)
}

// Layer constants distinguish the two timing slices the wrapper records.
// Consumers map these to whatever histogram label scheme they want.
const (
	LayerAuthz = "store_wrapper_authz" // Authorization hook (BeforeCreate, BeforeUpdate, BeforeDelete, AfterGet, FilterList).
	LayerInner = "store_wrapper_inner" // Inner store call (Create, Get, List, Update, Delete, Watch).
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
	inner              K8sStorage
	authorizer         ResourceStorageAuthorizer
	preserveIdentity   bool
	tracer             trace.Tracer
	observer           Observer
	resource           schema.GroupResource
	watchFlushInterval time.Duration
	watchSendTimeout   time.Duration
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
		inner:            store,
		authorizer:       authz,
		resource:         resource,
		tracer:           noop.NewTracerProvider().Tracer(tracerName),
		observer:         noopObserver{},
		watchSendTimeout: defaultWatchSendTimeout,
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

func startSpan(ctx context.Context, tracer trace.Tracer, resource schema.GroupResource, method string) (context.Context, trace.Span) {
	return tracer.Start(ctx, "authz.storewrapper."+method, trace.WithAttributes(
		attribute.String("resource.group", resource.Group),
		attribute.String("resource.resource", resource.Resource),
	))
}

func (w *Wrapper) startSpan(ctx context.Context, method string) (context.Context, trace.Span) {
	return startSpan(ctx, w.tracer, w.resource, method)
}

func recordSpanError(span trace.Span, err error) {
	if err == nil {
		return
	}
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

func (w *Wrapper) observeAuthz(op string, start time.Time, err error) {
	w.observer.Observe(LayerAuthz, op, w.resource, time.Since(start), statusFromError(err))
}

func (w *Wrapper) observeInner(op string, start time.Time, err error) {
	w.observer.Observe(LayerInner, op, w.resource, time.Since(start), statusFromError(err))
}

func statusFromError(err error) string {
	if err == nil {
		return metaV1.StatusSuccess
	}
	if reason := errors.ReasonForError(err); reason != metaV1.StatusReasonUnknown {
		return string(reason)
	}
	return metaV1.StatusFailure
}

func (w *Wrapper) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metaV1.Table, error) {
	return w.inner.ConvertToTable(ctx, object, tableOptions)
}

func (w *Wrapper) Create(ctx context.Context, obj runtime.Object, createValidation k8srest.ValidateObjectFunc, options *metaV1.CreateOptions) (result runtime.Object, err error) {
	ctx, span := w.startSpan(ctx, "Create")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

	// Enforce authorization based on the user permissions before creating the object
	authzStart := time.Now()
	err = w.authorizer.BeforeCreate(ctx, obj)
	w.observeAuthz(OpBeforeCreate, authzStart, err)
	if err != nil {
		return nil, err
	}

	innerStart := time.Now()
	result, err = w.inner.Create(w.storeCtx(ctx), obj, createValidation, options)
	w.observeInner(OpCreate, innerStart, err)
	return result, err
}

func (w *Wrapper) Delete(ctx context.Context, name string, deleteValidation k8srest.ValidateObjectFunc, options *metaV1.DeleteOptions) (result runtime.Object, deleted bool, err error) {
	ctx, span := w.startSpan(ctx, "Delete")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

	// Fetch the object first to authorize
	storeCtx := w.storeCtx(ctx)
	getOpts := &metaV1.GetOptions{TypeMeta: options.TypeMeta}
	if options.Preconditions != nil {
		getOpts.ResourceVersion = *options.Preconditions.ResourceVersion
	}
	innerGetStart := time.Now()
	var obj runtime.Object
	obj, err = w.inner.Get(storeCtx, name, getOpts)
	w.observeInner(OpDeleteGet, innerGetStart, err)
	if err != nil {
		return nil, false, err
	}

	// Enforce authorization based on the user permissions
	authzStart := time.Now()
	err = w.authorizer.BeforeDelete(ctx, obj)
	w.observeAuthz(OpBeforeDelete, authzStart, err)
	if err != nil {
		return nil, false, err
	}

	innerStart := time.Now()
	result, deleted, err = w.inner.Delete(storeCtx, name, deleteValidation, options)
	w.observeInner(OpDelete, innerStart, err)
	return result, deleted, err
}

func (w *Wrapper) Destroy() {
	w.inner.Destroy()
}

func (w *Wrapper) Get(ctx context.Context, name string, options *metaV1.GetOptions) (item runtime.Object, err error) {
	ctx, span := w.startSpan(ctx, "Get")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

	innerStart := time.Now()
	item, err = w.inner.Get(w.storeCtx(ctx), name, options)
	w.observeInner(OpGet, innerStart, err)
	if err != nil {
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the object
	authzStart := time.Now()
	err = w.authorizer.AfterGet(ctx, item)
	w.observeAuthz(OpAfterGet, authzStart, err)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (w *Wrapper) GetSingularName() string {
	return w.inner.GetSingularName()
}

func (w *Wrapper) List(ctx context.Context, options *internalversion.ListOptions) (result runtime.Object, err error) {
	ctx, span := w.startSpan(ctx, "List")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

	innerStart := time.Now()
	var list runtime.Object
	list, err = w.inner.List(w.storeCtx(ctx), options)
	w.observeInner(OpList, innerStart, err)
	if err != nil {
		return nil, err
	}

	// Enforce authorization based on the user permissions after retrieving the list
	authzStart := time.Now()
	result, err = w.authorizer.FilterList(ctx, list)
	w.observeAuthz(OpFilterList, authzStart, err)
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
) (result runtime.Object, updated bool, err error) {
	ctx, span := w.startSpan(ctx, "Update")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

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
	result, updated, err = w.inner.Update(w.storeCtx(ctx), name, wrappedObjInfo, createValidation, updateValidation, forceAllowCreate, options)
	// Technically also includes the authorizer time, but it's not worth the complexity to split it out.
	w.observeInner(OpUpdate, innerStart, err)
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

func (a *authorizedUpdateInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (updatedObj runtime.Object, err error) {
	// Get the updated object
	updatedObj, err = a.inner.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}

	// Enforce authorization using the original user context
	authzCtx, span := startSpan(a.userCtx, a.tracer, a.resource, "UpdateAuthz")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

	authzStart := time.Now()
	err = a.authorizer.BeforeUpdate(authzCtx, oldObj, updatedObj)
	// OpUpdate includes OpBeforeUpdate latency (BeforeUpdate runs inside the inner
	// store via UpdatedObject). We'll need to subtract OpBeforeUpdate for pure storage time.
	a.observer.Observe(LayerAuthz, OpBeforeUpdate, a.resource, time.Since(authzStart), statusFromError(err))
	if err != nil {
		return nil, err
	}

	return updatedObj, nil
}

func (w *Wrapper) Watch(ctx context.Context, options *internalversion.ListOptions) (result watch.Interface, err error) {
	ctx, span := w.startSpan(ctx, "WatchSetup")
	defer func() {
		recordSpanError(span, err)
		span.End()
	}()

	// Check if the underlying storage supports Watch
	watcher, ok := w.inner.(k8srest.Watcher)
	if !ok {
		err = fmt.Errorf("watch is not supported on the underlying storage")
		return nil, err
	}

	// Build the filter once, before starting the watch, so callers get an immediate
	// error if authorization state cannot be resolved (e.g. auth backend unavailable).
	var filter WatchEventFilter
	watchFilterStart := time.Now()
	filter, err = w.authorizer.WatchFilter(ctx)
	w.observeAuthz(OpWatchFilter, watchFilterStart, err)
	if err != nil {
		return nil, err
	}
	// Fail-closed: a nil filter is treated as RejectAllWatchFilter.
	// Implementors should return PassThroughWatchFilter explicitly for unrestricted resources.
	if filter == nil {
		err = errors.NewUnauthorized("watch denied")
		return nil, err
	}

	// Call the underlying storage's Watch method
	var inner watch.Interface
	inner, err = watcher.Watch(w.storeCtx(ctx), options)
	if err != nil {
		return nil, err
	}

	if isPassThroughWatchFilter(filter) {
		span.SetAttributes(attribute.Bool("filtered", false))
		return inner, nil
	}

	// Return a new filtered watcher that runs the filter over the buffered events
	// and forwards the events to the caller.
	result = newFilteredWatcher(ctx, w.tracer, w.observer, w.resource, inner, filter, w.watchFlushInterval, w.watchSendTimeout)
	span.SetAttributes(attribute.Bool("filtered", true))
	return result, nil
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
	tracer        trace.Tracer
	observer      Observer
	resource      schema.GroupResource
	inner         watch.Interface  // The underlying watch.Interface.
	filter        WatchEventFilter // Filter to apply to the buffered events.
	flushInterval time.Duration    // The interval to flush the buffered events.
	result        chan watch.Event // Forwarded events to the caller.
	stopOnce      sync.Once        // Ensures Stop() is called only once to prevent race conditions.
	done          chan struct{}    // Closed when the watcher Stop() method is called.
	pending       []watch.Event    // Buffered events awaiting flush; only accessed from run goroutine.
	sendTimeout   time.Duration    // The timeout for sending an event to the caller.
}

// watchBatchSize is the maximum number of events buffered before a forced flush.
// Matches watch.DefaultChanSize so the batch can never exceed the inner channel capacity.
const watchBatchSize = 100

func newFilteredWatcher(ctx context.Context,
	tracer trace.Tracer,
	observer Observer,
	resource schema.GroupResource,
	inner watch.Interface,
	filter WatchEventFilter,
	flushInterval time.Duration,
	sendTimeout time.Duration) *filteredWatcher {
	fw := &filteredWatcher{
		tracer:        tracer,
		observer:      observer,
		resource:      resource,
		inner:         inner,
		filter:        filter,
		flushInterval: flushInterval,
		result:        make(chan watch.Event, watch.DefaultChanSize),
		done:          make(chan struct{}),
		sendTimeout:   sendTimeout,
	}
	go fw.run(ctx)
	return fw
}

type sendEventResult int

const (
	sendEventSuccess sendEventResult = iota
	sendEventTimeout
	sendEventStopped
)

// statusFromSendResult converts a sendEventResult to a string status.
// Use statuses consistent with the statusFromError function.
func statusFromSendResult(r sendEventResult) string {
	if r == sendEventTimeout {
		return string(metaV1.StatusReasonTimeout)
	}
	return metaV1.StatusSuccess
}

// sendEvent forwards an event to the caller.
// It returns if the user context is done or the watcher is stopped.
func (fw *filteredWatcher) sendEvent(ctx context.Context, event watch.Event) sendEventResult {
	// If we could not send the event on time, emit an Error
	// and shut down to release backpressure on the inner storage.
	timer := time.NewTimer(fw.sendTimeout)
	select {
	case <-ctx.Done(): // User context is done.
		return sendEventStopped
	case <-fw.done: // Closed when the watcher Stop() method is called.
		return sendEventStopped
	case fw.result <- event: // Forward the event to the caller.
		return sendEventSuccess
	case <-timer.C: // Consumer is too slow, emit Timeout Error and tear down watch.
		select {
		case fw.result <- watch.Event{Type: watch.Error, Object: &metaV1.Status{
			Status: metaV1.StatusFailure, Reason: metaV1.StatusReasonTimeout,
			Message: "watch consumer too slow",
		}}:
		default:
		}
		// A bit redundant with run's defer, but it explicits the intent.
		fw.Stop()
		return sendEventTimeout
	}
}

func (fw *filteredWatcher) filterEvents(ctx context.Context, pending []watch.Event) (allowed []bool, err error) {
	_, span := startSpan(ctx, fw.tracer, fw.resource, "Watch.FilterEvents")
	span.SetAttributes(attribute.Int("events_count", len(pending)))
	defer func(startTime time.Time) {
		recordSpanError(span, err)
		fw.observer.Observe(LayerAuthz, OpFilterWatchEvents, fw.resource, time.Since(startTime), statusFromError(err))
		span.End()
	}(time.Now())

	allowed, err = fw.filter(pending)
	if err != nil {
		return nil, err
	}

	if len(allowed) != len(pending) {
		return nil, fmt.Errorf("watch filter contract violation: returned %d entries for %d events", len(allowed), len(pending))
	}
	return allowed, nil
}

func (fw *filteredWatcher) sendAllowed(ctx context.Context, pending []watch.Event, allowed []bool) bool {
	_, span := startSpan(ctx, fw.tracer, fw.resource, "Watch.SendEvents")
	sent := 0
	result := sendEventSuccess

	defer func(startTime time.Time) {
		span.SetAttributes(attribute.String("send_result", statusFromSendResult(result)))
		span.SetAttributes(attribute.Int("sent_count", sent))
		if result == sendEventTimeout {
			recordSpanError(span, errutil.Internal("watch event send timed out"))
		}
		span.End()
		fw.observer.Observe(LayerInner, OpSendWatchEvents, fw.resource, time.Since(startTime), statusFromSendResult(result))
	}(time.Now())

	for i, event := range pending {
		if allowed[i] {
			result = fw.sendEvent(ctx, event)
			if result != sendEventSuccess {
				return false
			}
			sent++
		}
	}
	return true
}

func (fw *filteredWatcher) flush(ctx context.Context) bool {
	if len(fw.pending) == 0 {
		return true
	}

	allowed, err := fw.filterEvents(ctx, fw.pending)
	if err != nil {
		errEvent := watch.Event{Type: watch.Error, Object: &metaV1.Status{Status: metaV1.StatusFailure, Message: err.Error()}}
		_ = fw.sendEvent(ctx, errEvent)
		fw.inner.Stop()
		fw.pending = fw.pending[:0]
		return false
	}
	ok := fw.sendAllowed(ctx, fw.pending, allowed)
	fw.pending = fw.pending[:0]
	return ok
}

func (fw *filteredWatcher) run(ctx context.Context) {
	defer func() {
		fw.Stop()
		close(fw.result)
	}()

	// A nil channel blocks forever in select, disabling the ticker case when
	// flushInterval is 0 (each event is flushed inline immediately instead).
	var tickerC <-chan time.Time
	if fw.flushInterval > 0 {
		t := time.NewTicker(fw.flushInterval)
		defer t.Stop()
		tickerC = t.C
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-fw.done:
			return
		case event, ok := <-fw.inner.ResultChan():
			if !ok {
				return
			}
			// Protocol events carry no resource data and must never be delayed.
			if event.Type == watch.Bookmark || event.Type == watch.Error {
				if !fw.flush(ctx) {
					return
				}
				if fw.sendEvent(ctx, event) != sendEventSuccess {
					return
				}
				continue
			}
			fw.pending = append(fw.pending, event)
			if fw.flushInterval == 0 || len(fw.pending) >= watchBatchSize {
				if !fw.flush(ctx) {
					return
				}
			}
		case <-tickerC:
			if !fw.flush(ctx) {
				return
			}
		}
	}
}

func (fw *filteredWatcher) Stop() {
	fw.stopOnce.Do(func() {
		close(fw.done)
		fw.inner.Stop()
	})
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
	return PassThroughWatchFilter, nil
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
