package informer

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/resources/dashboards"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
)

var _ registry.BackgroundService = (*Factory)(nil)
var _ registry.CanBeDisabled = (*Factory)(nil)

type Factory struct {
	dynamicinformer.DynamicSharedInformerFactory

	enabled  bool
	watchers map[schema.GroupVersionResource]ResourceWatcher
}

func ProvideFactory(
	cfg *rest.Config,
	features featuremgmt.FeatureToggles,
	dashboardController *dashboards.Controller,
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

		enabled:  enabled,
		watchers: make(map[schema.GroupVersionResource]ResourceWatcher),
	}

	// TODO: ಠ__ಠ
	// we can't rely on the background service to start after the informers register themselves
	// so we need to register the informers here for now.
	f.AddInformer(dashboards.CRD, dashboardController)

	return f, nil
}

func (f *Factory) AddInformer(gcrd k8ssys.Kind, watcher ResourceWatcher) {
	gvk := gcrd.GVK()
	gvr := schema.GroupVersionResource{
		Group:    gvk.Group,
		Version:  gvk.Version,
		Resource: gcrd.Schema.Spec.Names.Plural,
	}
	f.watchers[gvr] = watcher
}

func (f *Factory) Run(ctx context.Context) error {
	for gvr, watcher := range f.watchers {
		f.ForResource(gvr).Informer().AddEventHandler(
			cache.ResourceEventHandlerFuncs{
				AddFunc: func(obj interface{}) {
					watcher.OnAdd(ctx, obj)
				},
				UpdateFunc: func(oldObj, newObj interface{}) {
					watcher.OnUpdate(ctx, oldObj, newObj)
				},
				DeleteFunc: func(obj interface{}) {
					watcher.OnDelete(ctx, obj)
				},
			},
		)
	}
	f.Start(ctx.Done())
	<-ctx.Done()
	return nil
}

func (f *Factory) IsDisabled() bool {
	return !f.enabled
}
