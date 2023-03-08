package informer

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

var _ registry.BackgroundService = (*Factory)(nil)
var _ registry.CanBeDisabled = (*Factory)(nil)

type ResourceWatcher interface {
	Add(context.Context, any) error
	Update(ctx context.Context, old, new any) error
	Delete(context.Context, any) error
}

type Factory struct {
	dynamicinformer.DynamicSharedInformerFactory

	enabled   bool
	log       log.Logger
	watchers  map[schema.GroupVersionResource][]ResourceWatcher
	informers map[schema.GroupVersionResource]cache.SharedIndexInformer
}

func ProvideFactory(
	cfg *rest.Config,
	features featuremgmt.FeatureToggles,
) (*Factory, error) {
	enabled := features.IsEnabled(featuremgmt.FlagK8s)
	if !enabled {
		return &Factory{}, nil
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	f := &Factory{
		DynamicSharedInformerFactory: dynamicinformer.NewDynamicSharedInformerFactory(dyn, time.Minute),
		log:                          log.New("k8s.informer.factory"),
		enabled:                      enabled,
		watchers:                     make(map[schema.GroupVersionResource][]ResourceWatcher),
		informers:                    make(map[schema.GroupVersionResource]cache.SharedIndexInformer),
	}

	return f, nil
}

func (f *Factory) Run(ctx context.Context) error {
	f.initializeInformers()
	f.initializeWatchers(ctx)
	f.Start(ctx.Done())
	<-ctx.Done()
	return nil
}

func (f *Factory) IsDisabled() bool {
	return !f.enabled
}

func (f *Factory) AddWatcher(gcrd crd.Kind, watcher ResourceWatcher) {
	gvr := gcrd.GVR()
	f.watchers[gvr] = append(f.watchers[gvr], watcher)
}

func (f *Factory) initializeInformers() {
	for gvr := range f.watchers {
		f.informers[gvr] = f.ForResource(gvr).Informer()
	}
}

func (f *Factory) initializeWatchers(ctx context.Context) {
	for gvr, watchers := range f.watchers {
		for _, watcher := range watchers {
			f.informers[gvr].AddEventHandler(
				cache.ResourceEventHandlerFuncs{
					AddFunc: func(obj any) {
						if err := watcher.Add(ctx, obj); err != nil {
							f.log.Error("error adding resource", "err", err)
						}
					},
					UpdateFunc: func(oldObj, newObj any) {
						if err := watcher.Update(ctx, oldObj, newObj); err != nil {
							f.log.Error("error updating resource", "kind", gvr.Resource, "err", err)
						}
					},
					DeleteFunc: func(obj any) {
						if err := watcher.Delete(ctx, obj); err != nil {
							f.log.Error("error deleting resource", "err", err)
						}
					},
				},
			)
		}
	}
}
