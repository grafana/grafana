package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	pluginsapi "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
	client, err := pluginsv0alpha1.NewPluginClientFromGenerator(clientGenerator)
	if err != nil {
		return nil, err
	}

	grafanaComAPIURL := os.Getenv("GRAFANA_COM_API_URL")
	if grafanaComAPIURL == "" {
		grafanaComAPIURL = "https://grafana.com/api/plugins"
	}

	coreProvider := meta.NewCoreProvider()
	cloudProvider := meta.NewCloudProvider(grafanaComAPIURL)
	metaProviderManager := meta.NewProviderManager(coreProvider, cloudProvider)

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

						result, err := metaProviderManager.GetMeta(ctx, plugin.Spec.Id, plugin.Spec.Version)
						if err != nil {
							if errors.Is(err, meta.ErrMetaNotFound) {
								gr := schema.GroupResource{
									Group:    req.ResourceIdentifier.Group,
									Resource: req.ResourceIdentifier.Name,
								}
								return apierrors.NewNotFound(gr, plugin.Spec.Id)
							}

							logging.DefaultLogger.Error("Failed to fetch plugin metadata", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
							return apierrors.NewInternalError(fmt.Errorf("failed to fetch plugin metadata: %w", err))
						}
						w.Header().Set("Content-Type", "application/json")
						w.WriteHeader(http.StatusOK)
						if err = json.NewEncoder(w).Encode(result.Meta); err != nil {
							return err
						}

						return nil
					},
				},
			},
		},
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{
					Namespaced: true,
					Path:       "metas",
					Method:     http.MethodGet,
				}: func(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
					plugins, err := client.ListAll(ctx, req.ResourceIdentifier.Namespace, resource.ListOptions{})
					if err != nil {
						logging.DefaultLogger.Error("Failed to list plugins", "namespace", req.ResourceIdentifier.Namespace, "error", err)
						return apierrors.NewInternalError(fmt.Errorf("failed to list plugins: %w", err))
					}

					items := make([]pluginsv0alpha1.GetMeta, 0, len(plugins.Items))
					for _, plugin := range plugins.Items {
						result, err := metaProviderManager.GetMeta(ctx, plugin.Spec.Id, plugin.Spec.Version)
						if err != nil {
							// Log error but continue with other plugins
							logging.DefaultLogger.Warn("Failed to fetch metadata for plugin", "pluginId", plugin.Spec.Id, "version", plugin.Spec.Version, "error", err)
							continue
						}
						items = append(items, *result.Meta)
					}

					metasItems := make([]pluginsv0alpha1.V0alpha1GetMetasItems, 0, len(items))
					for _, item := range items {
						metasItems = append(metasItems, pluginsv0alpha1.V0alpha1GetMetasItems{
							Id:   item.Id,
							Type: string(item.Type),
							Name: item.Name,
						})
					}

					response := pluginsv0alpha1.GetMetas{
						Items: metasItems,
					}

					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					if err = json.NewEncoder(w).Encode(response); err != nil {
						return err
					}

					return nil
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

	// Register MetaProviderManager as a runnable so its cleanup goroutine is managed by the app lifecycle
	a.AddRunnable(metaProviderManager)

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
