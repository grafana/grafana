package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	investigationv1alpha1 "github.com/grafana/grafana/apps/investigation/pkg/apis/investigation/v1alpha1"
)

func New(cfg app.Config) (app.App, error) {
	var err error
	simpleConfig := simple.AppConfig{
		Name:       "investigation",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: investigationv1alpha1.InvestigationKind(),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   investigationv1alpha1.InvestigationKind().Group(),
		Version: investigationv1alpha1.InvestigationKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {investigationv1alpha1.InvestigationKind()},
	}
}
