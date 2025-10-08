package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsapi "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

// PluginsAppConfig holds configuration for the plugins app
type PluginsAppConfig struct {
	// No specific configuration needed at this time
}

func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"
	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: pluginsv0alpha1.PluginInstallKind(),
			},
			{
				Kind: pluginsv0alpha1.PluginMetaKind(),
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
