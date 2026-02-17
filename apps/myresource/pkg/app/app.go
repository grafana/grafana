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
	myresourcev1beta1 "github.com/grafana/grafana/apps/myresource/pkg/apis/myresource/v1beta1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "myresource",
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
				Kind: myresourcev1beta1.MyResourceKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						obj, ok := req.Object.(*myresourcev1beta1.MyResource)
						if !ok {
							return fmt.Errorf("expected MyResource object, got %T", req.Object)
						}

						if obj.Spec.Title == "" {
							return fmt.Errorf("title must not be empty")
						}
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
	gv := schema.GroupVersion{
		Group:   myresourcev1beta1.MyResourceKind().Group(),
		Version: myresourcev1beta1.MyResourceKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {myresourcev1beta1.MyResourceKind()},
	}
}
