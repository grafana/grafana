package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/klog/v2"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "gituisync",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing an error")
			},
		},
	}

	simpleApp, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}
	if err := simpleApp.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return simpleApp, err
}
