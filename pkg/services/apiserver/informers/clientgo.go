package informers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

// DeltaSource is the subset of cache.SharedIndexInformer the client-go controllers
// use to receive events: register a handler (whose registration reports
// HasSynced) and run until stopped.
type DeltaSource interface {
	AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error)
	Run(stopCh <-chan struct{})
}

// Clients is the client generator the supplied informers list and watch through.
func Clients(cfg *rest.Config) resource.ClientGenerator {
	return k8s.NewClientRegistry(*cfg, k8s.DefaultClientConfig())
}

// UntypedKind is the kind of a resource that has no SDK kind, served as
// resource.UntypedObject.
func UntypedKind(gvr schema.GroupVersionResource, kind string) resource.Kind {
	return resource.Kind{
		Schema: resource.NewSimpleSchema(gvr.Group, gvr.Version, &resource.UntypedObject{}, &resource.UntypedList{},
			resource.WithKind(kind), resource.WithPlural(gvr.Resource)),
		Codecs: map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()},
	}
}

// NewDeltaSource builds the informer req.Supplier selects (the API watch when it
// is nil) and adapts it for a client-go controller: each object is re-decoded
// into a newObject(), the type the controller's handlers assert.
func NewDeltaSource(req operator.InformerRequest, newObject func() runtime.Object) (DeltaSource, error) {
	if req.Supplier == nil {
		req.Supplier = simple.DefaultInformerSupplier
	}
	inf, err := operator.BuildInformer(req)
	if err != nil {
		return nil, err
	}
	return &clientGoSource{informer: inf, gvk: req.Kind.GroupVersionKind(), newObject: newObject, synced: make(chan struct{})}, nil
}

type clientGoSource struct {
	informer  operator.Informer
	gvk       schema.GroupVersionKind
	newObject func() runtime.Object
	synced    chan struct{}
}

func (s *clientGoSource) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	if err := s.informer.AddEventHandler(clientGoWatcher{source: s, handler: handler}); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *clientGoSource) Run(stopCh <-chan struct{}) {
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
		if s.informer.WaitForSync(ctx) == nil {
			close(s.synced)
		}
	}()
	if err := s.informer.Run(ctx); err != nil && ctx.Err() == nil {
		logging.FromContext(ctx).Error("informer stopped", "kind", s.gvk.String(), "error", err)
	}
}

// HasSynced makes the source its own handler registration: every handler is
// registered before Run, so each has seen the initial list once the informer has.
func (s *clientGoSource) HasSynced() bool {
	return cache.IsDone(s)
}

func (s *clientGoSource) HasSyncedChecker() cache.DoneChecker { return s }
func (s *clientGoSource) Name() string                        { return s.gvk.String() }
func (s *clientGoSource) Done() <-chan struct{}               { return s.synced }

// decode converts an SDK object to the controller's type through its JSON form.
func (s *clientGoSource) decode(obj resource.Object) (runtime.Object, error) {
	if obj.GetObjectKind().GroupVersionKind().Empty() {
		obj.GetObjectKind().SetGroupVersionKind(s.gvk)
	}
	data, err := json.Marshal(obj)
	if err != nil {
		return nil, fmt.Errorf("encode %s %s/%s: %w", s.gvk.Kind, obj.GetNamespace(), obj.GetName(), err)
	}
	out := s.newObject()
	if err := json.Unmarshal(data, out); err != nil {
		return nil, fmt.Errorf("decode %s %s/%s: %w", s.gvk.Kind, obj.GetNamespace(), obj.GetName(), err)
	}
	return out, nil
}

type clientGoWatcher struct {
	source  *clientGoSource
	handler cache.ResourceEventHandler
}

func (w clientGoWatcher) Add(_ context.Context, obj resource.Object) error {
	out, err := w.source.decode(obj)
	if err != nil {
		return err
	}
	w.handler.OnAdd(out, false)
	return nil
}

func (w clientGoWatcher) Update(_ context.Context, src, tgt resource.Object) error {
	oldObj, err := w.source.decode(src)
	if err != nil {
		return err
	}
	newObj, err := w.source.decode(tgt)
	if err != nil {
		return err
	}
	w.handler.OnUpdate(oldObj, newObj)
	return nil
}

func (w clientGoWatcher) Delete(_ context.Context, obj resource.Object) error {
	out, err := w.source.decode(obj)
	if err != nil {
		return err
	}
	w.handler.OnDelete(out)
	return nil
}
