package provisioning

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/metrics"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

// The provisioning operators run as app SDK simple apps. The SDK cannot yet take
// a kind's events from NATS or re-list it through the keys-only lister, so each
// kind keeps its provisioning delta source and the app is handed that source as
// its informer. Once the SDK ships those mechanisms, the informer supplier is the
// piece to replace; the controllers behind the watchers stay as they are.

const (
	appMetricsNamespace = "grafana_provisioning_operator"
	// appShutdownGrace is how long past its own drain an operator waits for the
	// app's runnables to stop before exiting anyway.
	appShutdownGrace = 30 * time.Second
)

// watchedKind is a provisioning kind an operator app watches: the delta source
// its events come from and the controller handler they are dispatched to.
type watchedKind struct {
	info    utils.ResourceInfo
	source  informer.DeltaSource
	handler cache.ResourceEventHandler
}

type operatorApp struct {
	*simple.App
	informers []*deltaSourceInformer
}

func newOperatorApp(name string, logger logging.Logger, kinds ...watchedKind) (*operatorApp, error) {
	byGVK := make(map[schema.GroupVersionKind]*deltaSourceInformer, len(kinds))
	informers := make([]*deltaSourceInformer, 0, len(kinds))
	managed := make([]simple.AppManagedKind, 0, len(kinds))
	for _, k := range kinds {
		kind := sdkKind(k.info)
		inf := &deltaSourceInformer{gvk: kind.GroupVersionKind(), source: k.source, logger: logger}
		byGVK[inf.gvk] = inf
		informers = append(informers, inf)
		managed = append(managed, simple.AppManagedKind{
			Kind:    kind,
			Watcher: handlerWatcher{handler: k.handler},
			// The controllers manage their own finalizers; the SDK must not add one.
			ReconcileOptions: simple.BasicReconcileOptions{UsePlain: true},
		})
	}

	supplier := func(kind resource.Kind, _ resource.ClientGenerator, _ operator.InformerOptions) (operator.Informer, error) {
		inf, ok := byGVK[kind.GroupVersionKind()]
		if !ok {
			return nil, fmt.Errorf("no delta source for kind %s", kind.GroupVersionKind())
		}
		return inf, nil
	}

	app, err := simple.NewApp(simple.AppConfig{
		Name:            name,
		ClientGenerator: noClients{},
		InformerConfig: simple.AppInformerConfig{
			InformerSupplier: supplier,
			MetricsConfig:    metrics.DefaultConfig(appMetricsNamespace),
		},
		ManagedKinds:  managed,
		MetricsConfig: metrics.DefaultConfig(appMetricsNamespace),
	})
	if err != nil {
		return nil, fmt.Errorf("create %s app: %w", name, err)
	}
	return &operatorApp{App: app, informers: informers}, nil
}

// WaitForSync blocks until every watched kind's informer has synced.
func (a *operatorApp) WaitForSync(ctx context.Context) error {
	for _, inf := range a.informers {
		if err := inf.WaitForSync(ctx); err != nil {
			return err
		}
	}
	return nil
}

// AddSyncedRunnable runs f as part of the app once every watched kind has synced.
func (a *operatorApp) AddSyncedRunnable(f func(ctx context.Context) error) {
	a.AddRunnable(runnableFunc(func(ctx context.Context) error {
		if err := a.WaitForSync(ctx); err != nil {
			return err
		}
		return f(ctx)
	}))
}

// Run registers the app's metrics and runs it until ctx is done, then waits up to
// shutdownTimeout for its runnables to stop.
func (a *operatorApp) Run(ctx context.Context, reg prometheus.Registerer, shutdownTimeout time.Duration, logger logging.Logger) error {
	if reg != nil {
		for _, c := range a.PrometheusCollectors() {
			if err := reg.Register(c); err != nil {
				return fmt.Errorf("register app metrics: %w", err)
			}
		}
	}

	done := make(chan error, 1)
	go func() { done <- a.Runner().Run(ctx) }()

	select {
	case err := <-done:
		return err
	case <-ctx.Done():
	}

	select {
	case err := <-done:
		return err
	case <-time.After(shutdownTimeout):
		logger.Warn("shutdown timeout exceeded, forcing exit", "timeout", shutdownTimeout)
		return nil
	}
}

type runnableFunc func(ctx context.Context) error

func (f runnableFunc) Run(ctx context.Context) error { return f(ctx) }

// sdkKind describes a provisioning type to the app. The app never decodes or
// writes it: the delta source supplies the objects, wrapped in deliveries.
func sdkKind(info utils.ResourceInfo) resource.Kind {
	gvk := info.GroupVersionKind()
	return resource.Kind{
		Schema: resource.NewSimpleSchema(gvk.Group, gvk.Version, &delivery{}, &resource.UntypedList{},
			resource.WithKind(gvk.Kind),
			resource.WithPlural(info.GetName()),
		),
	}
}

// delivery carries one object from a delta source through the SDK's informer
// controller, which only deals in resource.Object, so the controller handler
// receives exactly what the source delivered: the typed object or tombstone, and
// whether it came from the initial list. Only the metadata the SDK reads (the
// retry key and its dequeue policy) is copied onto the embedded object.
type delivery struct {
	resource.UntypedObject
	raw             any
	isInInitialList bool
}

func newDelivery(gvk schema.GroupVersionKind, raw any, isInInitialList bool) *delivery {
	d := &delivery{raw: raw, isInInitialList: isInInitialList}
	d.SetGroupVersionKind(gvk)

	obj := raw
	if tombstone, ok := raw.(cache.DeletedFinalStateUnknown); ok {
		obj = tombstone.Obj
	}
	if m, err := meta.Accessor(obj); err == nil {
		d.Namespace = m.GetNamespace()
		d.Name = m.GetName()
		d.UID = m.GetUID()
		d.ResourceVersion = m.GetResourceVersion()
		d.Generation = m.GetGeneration()
	}
	return d
}

func asDelivery(obj resource.Object) (*delivery, error) {
	d, ok := obj.(*delivery)
	if !ok {
		return nil, fmt.Errorf("expected a delta source delivery, got %T", obj)
	}
	return d, nil
}

// deltaSourceInformer offers a provisioning delta source to the app as an
// operator.Informer.
type deltaSourceInformer struct {
	gvk           schema.GroupVersionKind
	source        informer.DeltaSource
	logger        logging.Logger
	registrations []cache.ResourceEventHandlerRegistration
}

// AddEventHandler must be called before Run: the NATS-backed sources keep no
// cache to replay to a late handler. The app registers its handler in NewApp.
func (i *deltaSourceInformer) AddEventHandler(w operator.ResourceWatcher) error {
	ctx := context.Background()
	report := func(action string, err error) {
		if err != nil {
			i.logger.Error("failed to dispatch event", "kind", i.gvk.String(), "action", action, "error", err)
		}
	}
	reg, err := i.source.AddEventHandler(cache.ResourceEventHandlerDetailedFuncs{
		AddFunc: func(obj any, isInInitialList bool) {
			report("add", w.Add(ctx, newDelivery(i.gvk, obj, isInInitialList)))
		},
		UpdateFunc: func(oldObj, newObj any) {
			report("update", w.Update(ctx, newDelivery(i.gvk, oldObj, false), newDelivery(i.gvk, newObj, false)))
		},
		DeleteFunc: func(obj any) {
			report("delete", w.Delete(ctx, newDelivery(i.gvk, obj, false)))
		},
	})
	if err != nil {
		return fmt.Errorf("add %s event handler: %w", i.gvk, err)
	}
	i.registrations = append(i.registrations, reg)
	return nil
}

func (i *deltaSourceInformer) Run(ctx context.Context) error {
	i.source.Run(ctx.Done())
	return nil
}

func (i *deltaSourceInformer) WaitForSync(ctx context.Context) error {
	synced := make([]cache.InformerSynced, 0, len(i.registrations))
	for _, reg := range i.registrations {
		synced = append(synced, reg.HasSynced)
	}
	if !cache.WaitForCacheSync(ctx.Done(), synced...) {
		return fmt.Errorf("%s informer did not sync: %w", i.gvk, context.Cause(ctx))
	}
	return nil
}

// handlerWatcher hands each delivery back to the controller handler it was meant
// for, unwrapped.
type handlerWatcher struct {
	handler cache.ResourceEventHandler
}

func (w handlerWatcher) Add(_ context.Context, obj resource.Object) error {
	d, err := asDelivery(obj)
	if err != nil {
		return err
	}
	w.handler.OnAdd(d.raw, d.isInInitialList)
	return nil
}

func (w handlerWatcher) Update(_ context.Context, src, tgt resource.Object) error {
	oldObj, err := asDelivery(src)
	if err != nil {
		return err
	}
	newObj, err := asDelivery(tgt)
	if err != nil {
		return err
	}
	w.handler.OnUpdate(oldObj.raw, newObj.raw)
	return nil
}

func (w handlerWatcher) Delete(_ context.Context, obj resource.Object) error {
	d, err := asDelivery(obj)
	if err != nil {
		return err
	}
	w.handler.OnDelete(d.raw)
	return nil
}

// noClients refuses to build clients: every kind an operator app watches is
// served by its delta source, so the app has no reason to reach the apiserver.
type noClients struct{}

func (noClients) ClientFor(kind resource.Kind) (resource.Client, error) {
	return nil, fmt.Errorf("provisioning operator app builds no client for %s", kind.GroupVersionKind())
}

func (noClients) GetCustomRouteClient(gv schema.GroupVersion, _ string) (resource.CustomRouteClient, error) {
	return nil, fmt.Errorf("provisioning operator app builds no custom route client for %s", gv)
}

func (noClients) DiscoveryClient() (resource.DiscoveryClient, error) {
	return nil, errors.New("provisioning operator app builds no discovery client")
}
