package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: pluginsv0alpha1.PluginKind(),
			},
			//{
			//	Kind: pluginsv0alpha1.PluginInstallKind(),
			//},
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
	pluginGV := schema.GroupVersion{
		Group:   pluginsv0alpha1.PluginKind().Group(),
		Version: pluginsv0alpha1.PluginKind().Version(),
	}
	//pluginInstallGV := schema.GroupVersion{
	//	Group:   pluginsv0alpha1.PluginInstallKind().Group(),
	//	Version: pluginsv0alpha1.PluginInstallKind().Version(),
	//}
	return map[schema.GroupVersion][]resource.Kind{
		pluginGV: {
			pluginsv0alpha1.PluginKind(),
		},
		//pluginInstallGV: {
		//	pluginsv0alpha1.PluginInstallKind(),
		//},
	}
}
