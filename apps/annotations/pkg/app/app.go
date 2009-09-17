package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	annotationsv0alpha1 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotation/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "annotation",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.FromContext(ctx).Error("Informer processing error", "error", err)
			},
		},
		ManagedKinds: []simple.AppManagedKind{{Kind: annotationsv0alpha1.AnnotationKind()}},
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
		Group:   annotationsv0alpha1.AnnotationKind().Group(),
		Version: annotationsv0alpha1.AnnotationKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {annotationsv0alpha1.AnnotationKind()},
	}
}
