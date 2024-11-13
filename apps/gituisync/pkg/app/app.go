package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/gituisync/pkg/apis/gituisync/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "gituisync",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing an error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:    v0alpha1.ConfigKind(),
				Watcher: &simple.Watcher{},
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, ar *app.AdmissionRequest) (*app.MutatingResponse, error) {
						return &app.MutatingResponse{
							UpdatedObject: ar.Object,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, ar *app.AdmissionRequest) error {
						return nil
					},
				},
			},
		},
	}

	simpleApp, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}
	if err := simpleApp.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return simpleApp, err
}

func GetKinds() map[schema.GroupVersion]resource.Kind {
	gv := schema.GroupVersion{
		Group:   v0alpha1.ConfigKind().Group(),
		Version: v0alpha1.ConfigKind().Version(),
	}
	return map[schema.GroupVersion]resource.Kind{
		gv: v0alpha1.ConfigKind(),
	}
}
