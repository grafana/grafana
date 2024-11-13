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

type GitUISyncConfig struct {
}

func New(cfg app.Config) (app.App, error) {
	gitSyncConfig, ok := cfg.SpecificConfig.(*GitUISyncConfig)
	klog.InfoS("got a specific config", "cfg", gitSyncConfig, "ok", ok)

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
				Kind:    v0alpha1.RepositoryKind(),
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
	kinds := []resource.Kind{
		v0alpha1.RepositoryKind(),
	}
	kindMap := make(map[schema.GroupVersion]resource.Kind, len(kinds))
	for _, kind := range kinds {
		gv := schema.GroupVersion{
			Group:   kind.Group(),
			Version: kind.Version(),
		}
		kindMap[gv] = kind
	}
	return kindMap
}
