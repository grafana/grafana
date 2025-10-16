package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	"k8s.io/apimachinery/pkg/runtime/schema"

	querycachingv1alpha1 "github.com/grafana/grafana/apps/querycaching/pkg/apis/querycaching/v1alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "correlation",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{{
			Kind: querycachingv1alpha1.QueryCacheConfigKind(),
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
		Group:   querycachingv1alpha1.QueryCacheConfigKind().Group(),
		Version: querycachingv1alpha1.QueryCacheConfigKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {querycachingv1alpha1.QueryCacheConfigKind()},
	}
}
