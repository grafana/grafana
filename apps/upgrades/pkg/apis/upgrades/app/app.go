package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	upgradesv0alpha1 "github.com/grafana/grafana/apps/upgrades/pkg/apis/upgrades/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

func New(cfg app.Config) (app.App, error) {
	log := logging.DefaultLogger.With("app", "upgrades.app")
	simpleConfig := simple.AppConfig{
		Name:       "upgrades",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: upgradesv0alpha1.UpgradeMetadataKind(),
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

	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(upgradesv0alpha1.UpgradeMetadataKind())
	if err != nil {
		return nil, err
	}

	a.AddRunnable(NewVersionChecker(log, client))
	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   upgradesv0alpha1.UpgradeMetadataKind().Group(),
		Version: upgradesv0alpha1.UpgradeMetadataKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {upgradesv0alpha1.UpgradeMetadataKind()},
	}
}
