package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	secretapis "github.com/grafana/grafana/apps/secret/pkg/apis"
	secretv0alpha1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/apps/secret/pkg/watchers"
)

type SecretConfig struct {
	EnableWatchers bool
}

func New(cfg app.Config) (app.App, error) {
	var (
		secureValueWatcher operator.ResourceWatcher
		keyManagerWatcher  operator.ResourceWatcher
	)

	secretConfig, ok := cfg.SpecificConfig.(*SecretConfig)
	if ok && secretConfig != nil && secretConfig.EnableWatchers {
		secureValue, err := watchers.NewSecureValueWatcher()
		if err != nil {
			return nil, fmt.Errorf("unable to create SecureValueWatcher: %w", err)
		}

		keyManager, err := watchers.NewKeyManagerWatcher()
		if err != nil {
			return nil, fmt.Errorf("unable to create KeyManagerWatcher: %w", err)
		}

		secureValueWatcher = secureValue
		keyManagerWatcher = keyManager
	}

	simpleConfig := simple.AppConfig{
		Name:       secretapis.LocalManifest().ManifestData.AppName,
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.FromContext(ctx).Error("informer error", "error", err.Error())
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:    secretv0alpha1.SecureValueKind(),
				Watcher: secureValueWatcher,
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
						// modify req.Object if needed
						return &app.MutatingResponse{
							UpdatedObject: req.Object,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						return nil
					},
				},
			},
			{
				Kind:    secretv0alpha1.KeyManagerKind(),
				Watcher: keyManagerWatcher,
				Mutator: &simple.Mutator{
					MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
						// modify req.Object if needed
						return &app.MutatingResponse{
							UpdatedObject: req.Object,
						}, nil
					},
				},
				Validator: &simple.Validator{
					ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
						return nil
					},
				},
			},
		},
	}

	app, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if err := app.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return app, nil
}

func GetKinds() map[schema.GroupVersion]resource.Kind {
	securevalue := schema.GroupVersion{
		Group:   secretv0alpha1.SecureValueKind().Group(),
		Version: secretv0alpha1.SecureValueKind().Version(),
	}

	keymanager := schema.GroupVersion{
		Group:   secretv0alpha1.KeyManagerKind().Group(),
		Version: secretv0alpha1.KeyManagerKind().Version(),
	}

	return map[schema.GroupVersion]resource.Kind{
		securevalue: secretv0alpha1.SecureValueKind(),
		keymanager:  secretv0alpha1.KeyManagerKind(),
	}
}
