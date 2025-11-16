package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/klog/v2"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
)

func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"

	specificConfig, ok := cfg.SpecificConfig.(*PluginAppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type")
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

	// Register MetaProviderManager as a runnable so its cleanup goroutine is managed by the app lifecycle
	a.AddRunnable(specificConfig.MetaProviderManager)

	return a, nil
}

type PluginAppConfig struct {
	MetaProviderManager *meta.ProviderManager
}
