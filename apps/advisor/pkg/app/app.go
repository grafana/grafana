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

func New(cfg app.Config) (app.App, error) {
	advisorConfig, ok := cfg.SpecificConfig.(*AdvisorConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
	}

	managedKinds := make([]simple.AppManagedKind, 0, len(registerChecks))
	for _, registeredCheck := range registerChecks {
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
					res, err := check.Run(ctx, obj)
					if err != nil {
						annotations["grafana.app/advisorCheckStatus"] = "errored"
						obj.SetAnnotations(annotations)
						_, err = client.Update(ctx, obj.GetStaticMetadata().Identifier(), obj, resource.UpdateOptions{})
						return err
					}

					annotations["grafana.app/advisorCheckStatus"] = "processed"
					res.SetAnnotations(annotations)
					_, err = client.Update(ctx, obj.GetStaticMetadata().Identifier(), res, resource.UpdateOptions{})
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
	for _, check := range registerChecks {
		kinds[gv] = append(kinds[gv], check.Kind())
	}

	return kinds
}
