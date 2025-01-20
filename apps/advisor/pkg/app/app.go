package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/common"

	// Trigger check registration
	_ "github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasource"
	_ "github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugin"
)

func New(cfg app.Config) (app.App, error) {
	advisorConfig, ok := cfg.SpecificConfig.(*common.AdvisorConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	managedTypes := map[string]common.Check{}
	for _, registeredCheck := range common.RegisterChecks {
		t := registeredCheck.Type()
		check := registeredCheck.New(advisorConfig)
		managedTypes[t] = check
	}
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
	if err != nil {
		return nil, err
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
				Watcher: &simple.Watcher{
					AddFunc: func(ctx context.Context, obj resource.Object) error {
						annotations := obj.GetAnnotations()
						if annotations["advisor.grafana.app/checkStatus"] != "" {
							// Already processed
							return nil
						}
						c := obj.(*advisorv0alpha1.Check)
						check := managedTypes[obj.GetLabels()["advisor.grafana.app/type"]]
						if check == nil {
							return fmt.Errorf("no check for type %s", obj.GetLabels()["advisor.grafana.app/type"])
						}
						res, err := check.Run(ctx, &c.Spec)
						if err != nil {
							annotations["advisor.grafana.app/checkStatus"] = "errored"
						} else {
							annotations["advisor.grafana.app/checkStatus"] = "processed"
							err = client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
								Operations: []resource.PatchOperation{{
									Operation: resource.PatchOpAdd,
									Path:      "/status/report",
									Value:     *res,
								}},
							}, resource.PatchOptions{}, obj)
							if err != nil {
								return err
							}
						}

						err = client.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
							Operations: []resource.PatchOperation{{
								Operation: resource.PatchOpAdd,
								Path:      "/metadata/annotations",
								Value:     annotations,
							}},
						}, resource.PatchOptions{}, obj)
						return err
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
		Group:   advisorv0alpha1.Group,
		Version: advisorv0alpha1.Version,
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {
			advisorv0alpha1.CheckKind(),
		},
	}
}
