package app

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	pluginsapi "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
	client, err := pluginsv0alpha1.NewPluginClientFromGenerator(clientGenerator)
	if err != nil {
		return nil, err
	}

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					klog.ErrorS(err, "Informer processing error")
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: pluginsv0alpha1.PluginKind(),
				CustomRoutes: simple.AppCustomRouteHandlers{
					simple.AppCustomRoute{
						Method: http.MethodGet,
						Path:   "meta",
					}: func(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
						plugin, err := client.Get(ctx, resource.Identifier{
							Namespace: req.ResourceIdentifier.Namespace,
							Name:      req.ResourceIdentifier.Name,
						})
						if err != nil {
							return err
						}
						logging.DefaultLogger.Debug("fetched plugin", "plugin", plugin)
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
	kinds := make(map[schema.GroupVersion][]resource.Kind)
	manifest := pluginsapi.LocalManifest()
	for _, v := range manifest.ManifestData.Versions {
		gv := schema.GroupVersion{
			Group:   manifest.ManifestData.Group,
			Version: v.Name,
		}
		for _, k := range v.Kinds {
			kind, ok := pluginsapi.ManifestGoTypeAssociator(k.Kind, v.Name)
			if ok {
				kinds[gv] = append(kinds[gv], kind)
			}
		}
	}
	return kinds
}
