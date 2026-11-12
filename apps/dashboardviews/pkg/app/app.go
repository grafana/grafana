package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardviewsv0alpha1 "github.com/grafana/grafana/apps/dashboardviews/pkg/apis/dashboardviews/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "dashboardviews",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: dashboardviewsv0alpha1.SavedDashboardViewKind(),
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
		Group:   dashboardviewsv0alpha1.SavedDashboardViewKind().Group(),
		Version: dashboardviewsv0alpha1.SavedDashboardViewKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {dashboardviewsv0alpha1.SavedDashboardViewKind()},
	}
}
