package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	investigationsv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
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
				Kind: investigationsv0alpha1.InvestigationKind(),
			},
			{
				Kind: investigationsv0alpha1.InvestigationIndexKind(),
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
		Group:   investigationsv0alpha1.InvestigationKind().Group(),
		Version: investigationsv0alpha1.InvestigationKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {
			investigationsv0alpha1.InvestigationKind(),
			investigationsv0alpha1.InvestigationIndexKind(),
		},
	}
}
