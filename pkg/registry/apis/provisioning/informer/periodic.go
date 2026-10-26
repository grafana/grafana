package informer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"
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
	return &periodicSource{informer: informer, syncedCh: make(chan struct{}), name: gvk.String()}, nil
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

// periodicSource exposes an app-sdk informer as the DeltaSource the controllers register against, so a source backed
// by the SDK is interchangeable with an apiserver-backed SharedIndexInformer at the wiring seam.
type periodicSource struct {
	informer *operator.PeriodicInformer
	name     string

	syncedOnce sync.Once
	syncedCh   chan struct{}
}

var _ DeltaSource = (*periodicSource)(nil)

func (s *periodicSource) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	if err := s.informer.AddEventHandler(handlerWatcher{handler: handler}); err != nil {
		return nil, err
	}
	return periodicRegistration{source: s}, nil
}

// Run blocks until stopCh is closed, mirroring cache.SharedIndexInformer.Run. Both goroutines it starts end with the
// context: the informer returns when it is done, and the deferred cancel releases the sync waiter.
func (s *periodicSource) Run(stopCh <-chan struct{}) {
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

type periodicRegistration struct {
	source *periodicSource
}

var _ cache.ResourceEventHandlerRegistration = periodicRegistration{}

func (r periodicRegistration) HasSynced() bool { return r.source.informer.HasSynced() }

func (r periodicRegistration) HasSyncedChecker() cache.DoneChecker { return periodicChecker(r) }

type periodicChecker struct {
	source *periodicSource
}

func (c periodicChecker) Name() string          { return "periodic-informer:" + c.source.name }
func (c periodicChecker) Done() <-chan struct{} { return c.source.syncedCh }
