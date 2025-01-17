package app

import (
	"context"
	"encoding/json"
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

	managedKinds := make([]simple.AppManagedKind, 0, len(common.RegisterChecks))
	for _, registeredCheck := range common.RegisterChecks {
		kind := registeredCheck.Kind()
		check := registeredCheck.New(advisorConfig)
		clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
		client, err := clientGenerator.ClientFor(kind)
		if err != nil {
			return nil, err
		}
		managedKinds = append(managedKinds, simple.AppManagedKind{
			Kind: kind,
			Watcher: &simple.Watcher{
				AddFunc: func(ctx context.Context, obj resource.Object) error {
					annotations := obj.GetAnnotations()
					if annotations["grafana.app/advisorCheckStatus"] != "" {
						// Already processed
						return nil
					}
					specBytes, err := json.Marshal(obj.GetSpec())
					if err != nil {
						return err
					}
					spec := &common.CheckData{}
					err = json.Unmarshal(specBytes, spec)
					if err != nil {
						return err
					}
					res, err := check.Run(ctx, spec)
					if err != nil {
						annotations["grafana.app/advisorCheckStatus"] = "errored"
						// obj.SetAnnotations(annotations)
					} else {
						annotations["grafana.app/advisorCheckStatus"] = "processed"
						// res.SetAnnotations(annotations)
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
		})
	}
	simpleConfig := simple.AppConfig{
		Name:       "advisor",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: managedKinds,
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
	kinds := map[schema.GroupVersion][]resource.Kind{
		gv: {},
	}
	for _, check := range common.RegisterChecks {
		kinds[gv] = append(kinds[gv], check.Kind())
	}

	return kinds
}
