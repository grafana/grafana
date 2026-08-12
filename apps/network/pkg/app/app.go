package app

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	networkv1alpha1 "github.com/grafana/grafana/apps/network/pkg/apis/network/v1alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "network",
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
				Kind: networkv1alpha1.NetworkKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						network, ok := req.Object.(*networkv1alpha1.Network)
						if !ok {
							return fmt.Errorf("expected Network object, got %T", req.Object)
						}

						return validateMachineLabel(network.Spec.MachineLabel)
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
	gv := schema.GroupVersion{
		Group:   networkv1alpha1.NetworkKind().Group(),
		Version: networkv1alpha1.NetworkKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {networkv1alpha1.NetworkKind()},
	}
}
