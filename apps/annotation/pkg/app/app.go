package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	annotationv0alpha1 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "annotation",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{{
			Kind: annotationv0alpha1.AnnotationKind(),
		},
		},
	}

	// Add custom route handlers if a TagHandler is provided in SpecificConfig.
	// The handler is created/owned by the registry layer and passed in via
	// SpecificConfig to avoid the apps package depending on the registry.
	if cfg.SpecificConfig != nil {
		if annotationConfig, ok := cfg.SpecificConfig.(*AnnotationConfig); ok && annotationConfig.TagHandler != nil {
			simpleConfig.VersionedCustomRoutes = map[string]simple.AppVersionRouteHandlers{
				"v0alpha1": {
					{
						Namespaced: true,
						Path:       "tags",
						Method:     "GET",
					}: annotationConfig.TagHandler,
				},
			}
		}
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
		Group:   annotationv0alpha1.AnnotationKind().Group(),
		Version: annotationv0alpha1.AnnotationKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {annotationv0alpha1.AnnotationKind()},
	}
}
