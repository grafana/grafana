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
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

const (
	typeLabel        = "advisor.grafana.app/type"
	statusAnnotation = "advisor.grafana.app/status"
)

func New(cfg app.Config) (app.App, error) {
	// Read config
	checkRegistry, ok := cfg.SpecificConfig.(checkregistry.CheckService)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	// Prepare storage client
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
	}

	// Initialize checks
	checkMap := map[string]checks.Check{}
	for _, c := range checkRegistry.Checks() {
		checkMap[c.Type()] = c
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
		// Group and version are the same for all checks
		Group:   advisorv0alpha1.CheckKind().Group(),
		Version: advisorv0alpha1.CheckKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {
			advisorv0alpha1.CheckKind(),
		},
	}
}
