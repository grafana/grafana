// Package controllerapp runs the provisioning controllers as an app SDK simple
// app, both in the standalone operators and in the provisioning API server.
//
// The SDK cannot yet take a kind's events from NATS or re-list it through the
// keys-only lister, so each kind keeps its provisioning delta source and the app
// is handed that source as its informer. Once the SDK ships those mechanisms,
// the informer supplier is the piece to replace; the controllers behind the
// watchers stay as they are.
package controllerapp

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

	"github.com/grafana/grafana/apps/provisioning/pkg/informer"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const metricsNamespace = "grafana_provisioning_controller"

// WatchedKind is a provisioning kind the app watches: the delta source its
// events come from and the controller handler they are dispatched to.
type WatchedKind struct {
	Info    utils.ResourceInfo
	Source  informer.DeltaSource
	Handler cache.ResourceEventHandler
	// OnSynced, when set, runs as part of the app once this kind's informer has
	// synced, typically the controller's workers.
	OnSynced func(ctx context.Context) error
}

type App struct {
	*simple.App
}

// New builds the app and registers its metrics on reg; a nil reg leaves them
// unregistered.
func New(name string, logger logging.Logger, reg prometheus.Registerer, kinds ...WatchedKind) (*App, error) {
	byGVK := make(map[schema.GroupVersionKind]*deltaSourceInformer, len(kinds))
	managed := make([]simple.AppManagedKind, 0, len(kinds))
	var synced []RunnableFunc
	for _, k := range kinds {
		kind := sdkKind(k.Info)
		inf := &deltaSourceInformer{gvk: kind.GroupVersionKind(), source: k.Source, logger: logger}
		byGVK[inf.gvk] = inf
		managed = append(managed, simple.AppManagedKind{
			Kind:    kind,
			Watcher: handlerWatcher{handler: k.Handler},
			// The controllers manage their own finalizers; the SDK must not add one.
			ReconcileOptions: simple.BasicReconcileOptions{UsePlain: true},
		})
		if k.OnSynced != nil {
			onSynced := k.OnSynced
			synced = append(synced, func(ctx context.Context) error {
				if err := inf.WaitForSync(ctx); err != nil {
					return err
				}
				return onSynced(ctx)
			})
		}
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
			MetricsConfig:    metrics.DefaultConfig(metricsNamespace),
		},
		ManagedKinds:  managed,
		MetricsConfig: metrics.DefaultConfig(metricsNamespace),
	})
	if err != nil {
		return nil, fmt.Errorf("create %s app: %w", name, err)
	}
	for _, r := range synced {
		app.AddRunnable(r)
	}
	if reg != nil {
		for _, c := range app.PrometheusCollectors() {
			if err := reg.Register(c); err != nil {
				return nil, fmt.Errorf("register %s app metrics: %w", name, err)
			}
		}
	}
	return &App{App: app}, nil
}

// Run runs the app until ctx is done, then waits up to shutdownTimeout for its
// runnables to stop.
func (a *App) Run(ctx context.Context, shutdownTimeout time.Duration, logger logging.Logger) error {
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

// RunnableFunc adapts a function to app.Runnable.
type RunnableFunc func(ctx context.Context) error

func (f RunnableFunc) Run(ctx context.Context) error { return f(ctx) }

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

// noClients refuses to build clients: every kind the app watches is served by
// its delta source, so the app has no reason to reach the apiserver.
type noClients struct{}

func (noClients) ClientFor(kind resource.Kind) (resource.Client, error) {
	return nil, fmt.Errorf("provisioning controller app builds no client for %s", kind.GroupVersionKind())
}

func (noClients) GetCustomRouteClient(gv schema.GroupVersion, _ string) (resource.CustomRouteClient, error) {
	return nil, fmt.Errorf("provisioning controller app builds no custom route client for %s", gv)
}

func (noClients) DiscoveryClient() (resource.DiscoveryClient, error) {
	return nil, errors.New("provisioning controller app builds no discovery client")
}

// LogErrors runs a long-lived loop, such as the job driver or the expired-job
// cleanup, as an app runnable. Its failure is logged rather than returned, so
// it does not stop the app's other controllers.
func LogErrors(logger logging.Logger, name string, run func(ctx context.Context) error) RunnableFunc {
	return func(ctx context.Context) error {
		if err := run(ctx); err != nil {
			logger.Error(name+" failed", "error", err)
		}
		logger.Info(name + " stopped")
		return nil
	}
}
