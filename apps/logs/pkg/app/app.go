package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	logs0alpha1 "github.com/grafana/grafana/apps/logs/pkg/apis/logs/v1alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "correlation",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.FromContext(ctx).Error("Informer processing error", "error", err)
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: logs0alpha1.LogsKind(),
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
		Group:   logs0alpha1.LogsKind().Group(),
		Version: logs0alpha1.LogsKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {logs0alpha1.LogsKind()},
	}
}
