package app

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	liveV1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
)

type LiveConfig struct {
	Enable bool
}

func getPatchClient(restConfig rest.Config, liveKind resource.Kind) (operator.PatchClient, error) {
	clientGenerator := k8s.NewClientRegistry(restConfig, k8s.ClientConfig{})
	return clientGenerator.ClientFor(liveKind)
}

func New(cfg app.Config) (app.App, error) {
	// liveConfig, ok := cfg.SpecificConfig.(*LiveConfig)

	simpleConfig := simple.AppConfig{
		Name:       "live",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},

		// Needs something
		ManagedKinds: []simple.AppManagedKind{{
			Kind: liveV1.ChannelKind(),
		}},
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
	gv := liveV1.ChannelKind().GroupVersionKind().GroupVersion()
	return map[schema.GroupVersion][]resource.Kind{
		gv: {liveV1.ChannelKind()},
	}
}
