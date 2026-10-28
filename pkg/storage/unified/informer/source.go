package informer

import (
	"errors"
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

// DeltaSource is what a controller registers against, whichever informer is behind it.
type DeltaSource = operator.DeltaSource

// NewPeriodicDeltaSource returns a DeltaSource backed by the app-sdk's re-list-only informer: it lists the resource
// on a jittered cadence and delivers every listed object as an add, keeping no cache. It suits idempotent,
// cadence-driven work which re-evaluates every object on each pass — age-based cleanup, for instance.
//
// The controllers keep their own generated types: the objects list carries them through unchanged, and the handlers
// receive them back. Nothing here requires the resource's kind to implement resource.Object.
func NewPeriodicDeltaSource(info ResourceInfo, zero resource.WrappedObjectType, resync time.Duration, page operator.PageFunc) (DeltaSource, error) {
	kind, err := sdkKind(info, resource.NewWrappedObject(zero))
	if err != nil {
		return nil, err
	}

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
	return source{operator.NewDeltaSource(informer)}, nil
}

// ResourceInfo is the pair of names a kind is addressed by: its GroupVersionKind, which the app-sdk's schema wants,
// and its GroupVersionResource, which names the subject the bus publishes on. Both are taken rather than derived
// because the app-sdk's simple schema pluralises a kind by appending "s", which several of these kinds are not.
type ResourceInfo interface {
	GroupVersionKind() schema.GroupVersionKind
	GroupVersionResource() schema.GroupVersionResource
}

// sdkKind builds the app-sdk kind an informer is parameterised on. A WrappedObject carries a generated type, whose
// own marshaling must not be re-wrapped.
func sdkKind(info ResourceInfo, zero resource.Object) (resource.Kind, error) {
	return resource.NewKind(resource.KindConfig{
		GroupVersionKind:     info.GroupVersionKind(),
		GroupVersionResource: info.GroupVersionResource(),
		Scope:                resource.NamespacedScope,
		Zero:                 zero,
		ZeroList:             &resource.UntypedList{},
		Codec:                resource.NewPassthroughJSONCodec(),
	})
}

// SDKKind builds the app-sdk kind for a resource, for the SDK APIs which are parameterised on one but read only
// its identity — the read-freshness recorder, for instance.
func SDKKind(info ResourceInfo) resource.Kind {
	kind, _ := sdkKind(info, &resource.UntypedObject{})
	return kind
}

// unwrapObject returns the object the lister wrapped, so a handler type-asserts the type it registered for.
func unwrapObject(obj any) any {
	if wrapped, ok := obj.(*resource.WrappedObject[resource.WrappedObjectType]); ok {
		return wrapped.Object
	}
	return obj
}

// source hands the controllers their own generated types back. The app-sdk's delta source dispatches the
// resource.Object the informer holds, which for these kinds is a WrappedObject around the generated type, so the
// handler is decorated to take it back out before the controller type-asserts it.
type source struct {
	*operator.InformerDeltaSource
}

func (s source) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	return s.InformerDeltaSource.AddEventHandler(unwrapping{handler: handler})
}

// busSource adds the snapshot reads, which the delta source does not expose: the informer behind it holds them.
type busSource struct {
	source
	bus *operator.BusInformer
}

var _ BusSource = busSource{}

func (s busSource) Count(namespace string) int    { return s.bus.Count(namespace) }
func (s busSource) Observe(obj resource.Object)   { s.bus.Observe(obj) }
func (s busSource) Forget(id resource.Identifier) { s.bus.Forget(id) }

// unwrapping takes the generated type back out of the wrapper before the controller's handler sees it.
type unwrapping struct {
	handler cache.ResourceEventHandler
}

var _ cache.ResourceEventHandler = unwrapping{}

func (h unwrapping) OnAdd(obj any, isInInitialList bool) {
	h.handler.OnAdd(unwrapObject(obj), isInInitialList)
}

func (h unwrapping) OnUpdate(oldObj, newObj any) {
	h.handler.OnUpdate(unwrapObject(oldObj), unwrapObject(newObj))
}

func (h unwrapping) OnDelete(obj any) {
	if tombstone, ok := obj.(cache.DeletedFinalStateUnknown); ok {
		tombstone.Obj = unwrapObject(tombstone.Obj)
		h.handler.OnDelete(tombstone)
		return
	}
	h.handler.OnDelete(unwrapObject(obj))
}

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
	// Metrics are the bus informer's collectors, shared across every source a process builds. Nil disables them.
	Metrics *operator.BusInformerMetrics
	// Delivery are the collectors the re-list reports its requests and projection on, shared with every other
	// informer shape in the process. Nil disables them.
	Delivery *operator.InformerDeliveryMetrics
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

	kind, err := sdkKind(info, resource.NewWrappedObject(zero))
	if err != nil {
		return nil, err
	}

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

	out := busSource{source: source{operator.NewDeltaSource(informer)}, bus: informer}
	if opts.Announcements != nil {
		// Registered first, and the informer dispatches to its watchers in order, so the announcement is in place
		// before a controller's handler has enqueued the key.
		if err := informer.AddEventHandler(opts.Announcements.Watcher()); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// busLister builds the re-list: identities where the server serves them, full objects otherwise. Which one served a
// re-list is reported on the app-sdk's projection counter, alongside its other delivery metrics.
func busLister(kind resource.Kind, opts BusSourceOptions, page operator.PageFunc) (operator.ResourceLister, error) {
	recorder := opts.Delivery.RelistRecorder(kind)
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
