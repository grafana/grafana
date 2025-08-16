package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsapi "github.com/grafana/grafana/apps/plugins/pkg/apis"
)

func ToName(id, version string) string {
	return fmt.Sprintf("%s-%s", id, version)
}

func New(cfg app.Config) (app.App, error) {
	managedKinds := []simple.AppManagedKind{}
	for _, kinds := range GetKinds() {
		for _, k := range kinds {
			managedKinds = append(managedKinds, simple.AppManagedKind{
				Kind: k,
			})
		}
	}

	// set the app config so that clients can use it
	appConfig = &cfg
	close(configReady)

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.FromContext(ctx).Error("informer processing error", "error", err)
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
