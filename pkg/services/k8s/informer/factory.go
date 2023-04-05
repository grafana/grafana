package informer

import (
	"context"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
)

type ResourceWatcher interface {
	Add(context.Context, any) error
	Update(ctx context.Context, old, new any) error
	Delete(context.Context, any) error
}

type Service interface {
	services.NamedService
}

type Informer interface {
	AddWatcher(gcrd crd.Kind, watcher ResourceWatcher)
}

type factory struct {
	*services.BasicService
	dynamicinformer.DynamicSharedInformerFactory
	log       log.Logger
	watchers  map[schema.GroupVersionResource][]ResourceWatcher
	informers map[schema.GroupVersionResource]cache.SharedIndexInformer
	stopCh    chan struct{}

	restConfigProvider apiserver.RestConfigProvider
}

func ProvideFactory(
	restConfigProvider apiserver.RestConfigProvider,
	features featuremgmt.FeatureToggles,
) (*factory, error) {

	f := &factory{
		log:                log.New("k8s.informer.factory"),
		watchers:           make(map[schema.GroupVersionResource][]ResourceWatcher),
		informers:          make(map[schema.GroupVersionResource]cache.SharedIndexInformer),
		stopCh:             make(chan struct{}),
		restConfigProvider: restConfigProvider,
	}

	f.BasicService = services.NewBasicService(f.start, f.running, nil).WithName(modules.KubernetesInformers)

	return f, nil
}

func (f *factory) AddWatcher(gcrd crd.Kind, watcher ResourceWatcher) {
	gvr := gcrd.GVR()
	f.watchers[gvr] = append(f.watchers[gvr], watcher)
}

func (f *factory) start(ctx context.Context) error {
	cfg := f.restConfigProvider.GetRestConfig()
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return err
	}
	f.DynamicSharedInformerFactory = dynamicinformer.NewDynamicSharedInformerFactory(dyn, time.Minute)
	f.initializeInformers()
	f.initializeWatchers(ctx)
	f.Start(f.stopCh)
	return nil
}

func (f *factory) running(ctx context.Context) error {
	<-ctx.Done()
	close(f.stopCh)
	return nil
}

func (f *factory) initializeInformers() {
	for gvr := range f.watchers {
		f.informers[gvr] = f.ForResource(gvr).Informer()
	}
}

func (f *factory) initializeWatchers(ctx context.Context) {
	for gvr, watchers := range f.watchers {
		for _, watcher := range watchers {
			_, err := f.informers[gvr].AddEventHandler(
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
			if err != nil {
				f.log.Error("error registering event handler", "kind", gvr, "error", err)
			}
		}
	}
}
