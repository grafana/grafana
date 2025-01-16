package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

type AdvisorConfig struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginRepo            repo.Service
	PluginContextProvider *plugincontext.Provider
	PluginClient          plugins.Client
}

var registerChecks = []checkRegisterer{}

func getPatchClient(restConfig rest.Config, advisorKind resource.Kind) (operator.PatchClient, error) {
	clientGenerator := k8s.NewClientRegistry(restConfig, k8s.ClientConfig{})
	c, err := clientGenerator.ClientFor(advisorKind)
	return c, err
}

func New(cfg app.Config) (app.App, error) {
	advisorConfig, ok := cfg.SpecificConfig.(*AdvisorConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}
	checks := make([]Check, 0, len(registerChecks))
	for _, registerCheck := range registerChecks {
		checks = append(checks, registerCheck(advisorConfig))
	}

	managedKinds := make([]simple.AppManagedKind, 0, len(checks))
	for _, check := range checks {
		managedKinds = append(managedKinds, simple.AppManagedKind{
			Kind: check.Kind(),
			// TODO: Remove this
			Mutator: &simple.Mutator{
				MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
					// modify req.Object if needed
					return &app.MutatingResponse{
						UpdatedObject: req.Object,
					}, nil
				},
			},
			// TODO: Remove this
			Validator: &simple.Validator{
				ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
					// do something here if needed
					return nil
				},
			},
			Watcher: &simple.Watcher{
				AddFunc: func(ctx context.Context, obj resource.Object) error {
					up, err := check.Updated(ctx, obj)
					if err != nil {
						return err
					}
					if up {
						return nil
					}
					res, err := check.Run(ctx, obj)
					if err != nil {
						return err
					}
					// TODO: Store result
					fmt.Println(res)

					patchClient, err := getPatchClient(cfg.KubeConfig, check.Kind())
					if err != nil {
						return err
					}
					patchErr := patchClient.PatchInto(ctx, obj.GetStaticMetadata().Identifier(), resource.PatchRequest{
						Operations: []resource.PatchOperation{{
							Operation: resource.PatchOpAdd,
							Path:      "/status",
							// TODO: Use "res" to update the status
							Value: advisorv0alpha1.DatasourceCheckStatus{AdditionalFields: map[string]interface{}{"foo": "bar"}},
						}},
					}, resource.PatchOptions{}, obj)
					return patchErr
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
		Group:   advisorv0alpha1.DatasourceCheckKind().Group(),
		Version: advisorv0alpha1.DatasourceCheckKind().Version(),
	}
	// A bit of a workaround to get the kinds
	checks := make([]Check, 0, len(registerChecks))
	for _, registerCheck := range registerChecks {
		checks = append(checks, registerCheck(&AdvisorConfig{}))
	}
	kinds := map[schema.GroupVersion][]resource.Kind{
		gv: {},
	}
	for _, check := range checks {
		kinds[gv] = append(kinds[gv], check.Kind())
	}

	return kinds
}
