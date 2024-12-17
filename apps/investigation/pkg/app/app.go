package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	investigationv1alpha1 "github.com/grafana/grafana/apps/investigation/pkg/apis/investigation/v1alpha1"
	"github.com/grafana/grafana/apps/investigation/pkg/watchers"
)

type InvestigationConfig struct {
	EnableWatchers bool
}

func New(cfg app.Config) (app.App, error) {
	var (
		investigationWatcher operator.ResourceWatcher
		err                  error
	)

	config, ok := cfg.SpecificConfig.(*InvestigationConfig)
	if ok && config.EnableWatchers {
		investigationWatcher, err = watchers.NewInvestigationWatcher()
		if err != nil {
			return nil, fmt.Errorf("unable to create InvestigationWatcher: %w", err)
		}
	}

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
				Kind:    investigationv1alpha1.InvestigationKind(),
				Watcher: investigationWatcher,
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
						// modify req.Object if needed
						return &app.MutatingResponse{
							UpdatedObject: req.Object,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						// do something here if needed
						return nil
					},
				},
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
