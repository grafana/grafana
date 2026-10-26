package informer

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/nats"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch/natsbus"
)

// NewPeriodicDeltaSource returns a DeltaSource backed by the app-sdk's re-list-only informer: it lists the resource
// on a jittered cadence and delivers every listed object as an add, keeping no cache. It suits idempotent,
// cadence-driven work which re-evaluates every object on each pass — age-based cleanup, for instance.
//
// The controllers keep their own generated types: the objects list carries them through unchanged, and the handlers
// receive them back. Nothing here requires the resource's kind to implement resource.Object.
func NewPeriodicDeltaSource(gvk schema.GroupVersionKind, resync time.Duration, list PeriodicListFunc) (DeltaSource, error) {
	// Only the schema's identity is read on this path: the lister produces the objects, so the kind's zero value is
	// never constructed.
	kind := resource.Kind{Schema: resource.NewSimpleSchema(gvk.Group, gvk.Version,
		&resource.UntypedObject{}, &resource.UntypedList{}, resource.WithKind(gvk.Kind))}

	informer, err := operator.NewPeriodicInformer(kind, periodicLister{list: list}, operator.PeriodicInformerOptions{
		ResyncInterval: resync,
	})
	if err != nil {
		return nil, err
	}
	return newDeltaSource(informer, gvk.String()), nil
}

// PeriodicListFunc returns every object of one resource kind, read straight from the API.
type PeriodicListFunc func(ctx context.Context) ([]runtime.Object, error)

// periodicLister adapts a list of the controllers' own types to the app-sdk's lister contract. The resource version
// is dropped: a re-list-only informer has no live stream to arbitrate against.
type periodicLister struct {
	list PeriodicListFunc
}

func (l periodicLister) List(ctx context.Context) ([]resource.Object, string, error) {
	objs, err := l.list(ctx)
	if err != nil {
		return nil, "", err
	}
	out := make([]resource.Object, 0, len(objs))
	for _, obj := range objs {
		wrapped, err := wrapObject(obj)
		if err != nil {
			return nil, "", err
		}
		out = append(out, wrapped)
	}
	return out, "", nil
}

// wrapObject presents a kubernetes object as the app-sdk's Object without the kind implementing it: WrappedObject
// supplies the spec and metadata accessors by delegation, and unwrapObject takes the original back out.
func wrapObject(obj runtime.Object) (resource.Object, error) {
	underlying, ok := obj.(resource.WrappedObjectType)
	if !ok {
		return nil, fmt.Errorf("cannot deliver %T: not a kubernetes object", obj)
	}
	return resource.NewWrappedObject(underlying), nil
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

	syncedOnce sync.Once
	syncedCh   chan struct{}
}

var _ DeltaSource = (*sdkSource)(nil)

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

// NewBusDeltaSource returns a DeltaSource backed by the app-sdk's bus informer: it takes live deltas from the
// change notifications unified storage publishes and re-lists on a jittered cadence to catch what the live stream
// did not deliver here.
//
// Live events carry identity only, as the Grafana-side informer's do: the controllers treat a notification as a
// signal and re-fetch the object in their reconcile. zero is the type they expect back — it is wrapped on the way
// in and unwrapped on the way out, so the resource's kind does not implement resource.Object.
func NewBusDeltaSource(subscriber nats.Subscriber, zero resource.WrappedObjectType, gvk schema.GroupVersionKind,
	resync time.Duration, list PeriodicListFunc, metrics *operator.BusInformerMetrics) (DeltaSource, error) {
	bus := natsbus.New(subscriber, log.New("provisioning.informer.bus"))
	if bus == nil {
		return nil, errors.New("nats is not enabled")
	}

	kind := resource.Kind{Schema: resource.NewSimpleSchema(gvk.Group, gvk.Version,
		resource.NewWrappedObject(zero), &resource.UntypedList{}, resource.WithKind(gvk.Kind))}

	informer, err := operator.NewBusInformer(kind, bus, periodicLister{list: list}, operator.BusInformerOptions{
		Payload:        operator.PayloadIdentity,
		ResyncInterval: resync,
		SharedGroup:    queueGroup,
		// The informer is the controller's only feed, so holding the initial list until the subscription opens would
		// stall its work while NATS is unavailable — at startup, before the embedded server has a client URL, for
		// instance. In degraded mode only the live-event latency is lost until the subscription opens.
		AllowDegradedStart: true,
		Metrics:            metrics,
	})
	if err != nil {
		return nil, err
	}
	return newDeltaSource(informer, gvk.String()), nil
}
