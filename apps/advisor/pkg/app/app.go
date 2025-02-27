package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkscheduler"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checktyperegisterer"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

func New(cfg app.Config) (app.App, error) {
	// Read config
	specificConfig, ok := cfg.SpecificConfig.(checkregistry.AdvisorAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}
	checkRegistry := specificConfig.CheckRegistry

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}

	// Initialize checks
	checkMap := map[string]checks.Check{}
	for _, c := range checkRegistry.Checks() {
		checkMap[c.ID()] = c
	}

	simpleConfig := simple.AppConfig{
		Name:       "advisor",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: advisorv0alpha1.CheckKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						if req.Object != nil {
							_, err := getCheck(req.Object, checkMap)
							return err
						}
						return nil
					},
				},
				Watcher: &simple.Watcher{
					AddFunc: func(ctx context.Context, obj resource.Object) error {
						check, err := getCheck(obj, checkMap)
						if err != nil {
							return err
						}
						return processCheck(ctx, client, obj, check)
					},
				},
			},
			{
				Kind: advisorv0alpha1.CheckTypeKind(),
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

	// Save check types as resources
	ctr, err := checktyperegisterer.New(cfg)
	if err != nil {
		return nil, err
	}
	a.AddRunnable(ctr)

	// Start scheduler
	csch, err := checkscheduler.New(cfg)
	if err != nil {
		return nil, err
	}
	a.AddRunnable(csch)

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		// Group and version are the same for all checks
		Group:   advisorv0alpha1.CheckKind().Group(),
		Version: advisorv0alpha1.CheckKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {
			advisorv0alpha1.CheckKind(),
			advisorv0alpha1.CheckTypeKind(),
		},
	}
}
