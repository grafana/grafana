package informer

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/resourcebus"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch/natsbus"
)

// DeltaSource is the subset of cache.SharedIndexInformer a controller uses to receive events: register a handler
// (whose registration reports HasSynced) and run until stopped. An apiserver-backed SharedIndexInformer satisfies it
// too, so the wiring can pick a source without the controller knowing which it is.
type DeltaSource interface {
	AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error)
	Run(stopCh <-chan struct{})
}

// NewPeriodicDeltaSource returns a DeltaSource backed by the app-sdk's re-list-only informer: it lists the resource
// on a jittered cadence and delivers every listed object as an add, keeping no cache. It suits idempotent,
// cadence-driven work which re-evaluates every object on each pass — age-based cleanup, for instance.
//
// The controllers keep their own generated types: the objects list carries them through unchanged, and the handlers
// receive them back. Nothing here requires the resource's kind to implement resource.Object.
func NewPeriodicDeltaSource(info ResourceInfo, zero resource.WrappedObjectType, resync time.Duration, page operator.PageFunc) (DeltaSource, error) {
	kind := sdkKind(info, resource.NewWrappedObject(zero))

	// Identity rather than the listed body: it carries the metadata a cadence-driven handler reads — the creation
	// timestamp an age-based cleanup ages off, the finalizers, the deletion timestamp — and unlike a conversion it
	// works whatever the list returns.
	lister, err := operator.NewPagedLister(kind, page, operator.PagedListerOptions{Payload: operator.PayloadIdentity})
	if err != nil {
		return nil, err
	}
	informer, err := operator.NewPeriodicInformer(kind, lister, operator.PeriodicInformerOptions{
		ResyncInterval: resync,
	})
	if err != nil {
		return nil, err
	}
	return newDeltaSource(informer, info.GroupVersionKind().String()), nil
}

// ResourceInfo is the pair of names a kind is addressed by: its GroupVersionKind, which the app-sdk's schema wants,
// and its GroupVersionResource, which names the subject the bus publishes on. Both are taken rather than derived
// because the app-sdk's simple schema pluralises a kind by appending "s", which several of these kinds are not.
type ResourceInfo interface {
	GroupVersionKind() schema.GroupVersionKind
	GroupVersionResource() schema.GroupVersionResource
}

// sdkKind builds the app-sdk kind an informer is parameterised on, with the resource's real plural.
func sdkKind(info ResourceInfo, zero resource.Object) resource.Kind {
	gvk := info.GroupVersionKind()
	return resource.Kind{Schema: resource.NewSimpleSchema(gvk.Group, gvk.Version, zero, &resource.UntypedList{},
		resource.WithKind(gvk.Kind), resource.WithPlural(info.GroupVersionResource().Resource))}
}

// SDKKind builds the app-sdk kind for a resource, for the SDK APIs which are parameterised on one but read only
// its identity — the read-freshness recorder, for instance.
func SDKKind(info ResourceInfo) resource.Kind {
	return sdkKind(info, &resource.UntypedObject{})
}

// unwrapObject returns the object the lister wrapped, so a handler type-asserts the type it registered for.
func unwrapObject(obj resource.Object) any {
	if wrapped, ok := obj.(*resource.WrappedObject[resource.WrappedObjectType]); ok {
		return wrapped.Object
	}
	return obj
}

// sdkInformer is the subset of the app-sdk's informers sdkSource drives. BusInformer and PeriodicInformer both
// satisfy it, so the delta source below is the one seam between them and the controllers.
type sdkInformer interface {
	AddEventHandler(operator.ResourceWatcher) error
	HasSynced() bool
	WaitForSync(context.Context) error
	Run(context.Context) error
}

func newDeltaSource(informer sdkInformer, name string) *sdkSource {
	return &sdkSource{informer: informer, name: name, syncedCh: make(chan struct{})}
}

// sdkSource exposes an app-sdk informer as the DeltaSource the controllers register against, so a source backed by
// the SDK is interchangeable with an apiserver-backed SharedIndexInformer at the wiring seam.
type sdkSource struct {
	informer sdkInformer
	name     string
	// bus is set for a bus-backed source; nil for the re-list-only one, which keeps no snapshot to read.
	bus *operator.BusInformer

	syncedOnce sync.Once
	syncedCh   chan struct{}
}

var _ DeltaSource = (*sdkSource)(nil)

func (s *sdkSource) Count(namespace string) int {
	if s.bus == nil {
		return 0
	}
	return s.bus.Count(namespace)
}

func (s *sdkSource) Observe(obj resource.Object) {
	if s.bus != nil {
		s.bus.Observe(obj)
	}
}

func (s *sdkSource) Forget(id resource.Identifier) {
	if s.bus != nil {
		s.bus.Forget(id)
	}
}

func (s *sdkSource) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	if err := s.informer.AddEventHandler(handlerWatcher{handler: handler}); err != nil {
		return nil, err
	}
	return sdkRegistration{source: s}, nil
}

// Run blocks until stopCh is closed, mirroring cache.SharedIndexInformer.Run. Both goroutines it starts end with the
// context: the informer returns when it is done, and the deferred cancel releases the sync waiter.
func (s *sdkSource) Run(stopCh <-chan struct{}) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		select {
		case <-stopCh:
			cancel()
		case <-ctx.Done():
		}
	}()
	go func() {
		if err := s.informer.WaitForSync(ctx); err == nil {
			s.syncedOnce.Do(func() { close(s.syncedCh) })
		}
	}()
	_ = s.informer.Run(ctx)
}

// handlerWatcher delivers the app-sdk informer's events to a client-go handler.
type handlerWatcher struct {
	handler cache.ResourceEventHandler
}

var _ operator.ResourceWatcher = handlerWatcher{}

func (w handlerWatcher) Add(_ context.Context, obj resource.Object) error {
	w.handler.OnAdd(unwrapObject(obj), false)
	return nil
}

func (w handlerWatcher) Update(_ context.Context, src, tgt resource.Object) error {
	w.handler.OnUpdate(unwrapObject(src), unwrapObject(tgt))
	return nil
}

func (w handlerWatcher) Delete(_ context.Context, obj resource.Object) error {
	w.handler.OnDelete(unwrapObject(obj))
	return nil
}

type sdkRegistration struct {
	source *sdkSource
}

var _ cache.ResourceEventHandlerRegistration = sdkRegistration{}

func (r sdkRegistration) HasSynced() bool { return r.source.informer.HasSynced() }

func (r sdkRegistration) HasSyncedChecker() cache.DoneChecker { return sdkChecker(r) }

type sdkChecker struct {
	source *sdkSource
}

func (c sdkChecker) Name() string          { return "app-sdk-informer:" + c.source.name }
func (c sdkChecker) Done() <-chan struct{} { return c.source.syncedCh }

// BusSourceOptions configures a bus-backed delta source beyond its list and resync.
type BusSourceOptions struct {
	// Namespace scopes both the subscription and the re-list; empty covers every namespace. The two must agree, or
	// the informer diffs a list against events it was never sent.
	Namespace string
	// Group is the name of the group across which the bus shares delivery, so each event reaches one replica of this
	// consumer rather than all of them. Empty delivers every event to every replica.
	Group string
	// Keys makes the periodic re-list ask storage for identities rather than object bodies. A nil lister, or a
	// server which does not serve the projection, leaves the full-object list.
	Keys operator.ResourceKeyLister
	// Announcements records what each live notification announced, for the read-freshness instrumentation. A nil
	// tracker disables it.
	Announcements *operator.AnnouncementTracker
	// Metrics are the app-sdk's delivery metrics, shared across every source a process builds. Nil disables them.
	Metrics *operator.BusInformerMetrics
}

// BusSource is a bus-backed DeltaSource which also exposes what the informer last reconciled with storage.
type BusSource interface {
	DeltaSource
	// Count reports how many objects of the namespace the informer last reconciled with storage. It lags by up to
	// one re-list and holds only what this replica was delivered, so it suits a staleness-tolerant count and
	// nothing a reconcile's correctness depends on.
	Count(namespace string) int
	// Observe records an object the consumer read for itself, so a Count taken straight after includes it. Under a
	// shared delivery group the live add may have gone to another replica, which would otherwise leave this one not
	// counting the object until its next re-list.
	Observe(obj resource.Object)
	// Forget drops an object the consumer found absent, so a Count taken straight after stops including it.
	Forget(id resource.Identifier)
}

// NewBusDeltaSource returns a DeltaSource backed by the app-sdk's bus informer: it takes live deltas from the
// change notifications unified storage publishes and re-lists on a jittered cadence to catch what the live stream
// did not deliver here.
//
// Live events carry identity only, as the Grafana-side informer's do: the controllers treat a notification as a
// signal and re-fetch the object in their reconcile. zero is the type they expect back — it is wrapped on the way
// in and unwrapped on the way out, so the resource's kind does not implement resource.Object.
func NewBusDeltaSource(subscriber nats.Subscriber, zero resource.WrappedObjectType, info ResourceInfo,
	resync time.Duration, page operator.PageFunc, opts BusSourceOptions) (BusSource, error) {
	bus := natsbus.New(subscriber, log.New("provisioning.informer.bus"))
	if bus == nil {
		return nil, errors.New("nats is not enabled")
	}

	kind := sdkKind(info, resource.NewWrappedObject(zero))

	lister, err := busLister(kind, opts, page)
	if err != nil {
		return nil, err
	}

	informer, err := operator.NewBusInformer(kind, bus, lister, operator.BusInformerOptions{
		Namespace:      opts.Namespace,
		Payload:        operator.PayloadIdentity,
		ResyncInterval: resync,
		Group:          resourcebus.Group{Name: opts.Group, Delivery: resourcebus.GroupDeliveryRoundRobin},
		// The informer is the controller's only feed, so holding the initial list until the subscription opens would
		// stall its work while NATS is unavailable — at startup, before the embedded server has a client URL, for
		// instance. In degraded mode only the live-event latency is lost until the subscription opens.
		AllowDegradedStart: true,
		Metrics:            opts.Metrics,
	})
	if err != nil {
		return nil, err
	}

	source := newDeltaSource(informer, info.GroupVersionKind().String())
	source.bus = informer
	if opts.Announcements != nil {
		// Registered first, and the informer dispatches to its watchers in order, so the announcement is in place
		// before a controller's handler has enqueued the key.
		if err := informer.AddEventHandler(opts.Announcements.Watcher()); err != nil {
			return nil, err
		}
	}
	return source, nil
}

// busLister builds the re-list: identities where the server serves them, full objects otherwise. Which one served a
// re-list is reported on the app-sdk's projection counter, alongside its other delivery metrics.
func busLister(kind resource.Kind, opts BusSourceOptions, page operator.PageFunc) (operator.ResourceLister, error) {
	recorder := opts.Metrics.RelistRecorder(kind)
	objects, err := operator.NewPagedLister(kind, page, operator.PagedListerOptions{
		// The controllers key off identity and re-fetch in their reconcile, and a dynamic client's unstructured
		// items cannot be converted into the kind anyway.
		Payload:  operator.PayloadIdentity,
		Recorder: recorder,
	})
	if err != nil {
		return nil, err
	}
	if opts.Keys == nil {
		return objects, nil
	}
	identities, err := operator.NewIdentityLister(kind, opts.Keys, operator.IdentityListerOptions{Recorder: recorder})
	if err != nil {
		return nil, err
	}
	return operator.NewFallbackLister(identities, objects)
}
