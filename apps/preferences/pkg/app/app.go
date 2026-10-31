package app

import (
	"context"

	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

// New builds the preferences app, which validates preferences. The app's own
// configuration is a *Config; without one the app has no defaults.
//
// The merged view, preferences/merged, is not a route: app-sdk refuses a route
// that shadows the resource. The host answers it with Config.MergedGetter.
func New(cfg app.Config) (app.App, error) {
	config, ok := cfg.SpecificConfig.(*Config)
	if !ok || config == nil {
		config = &Config{}
	}

	validator := &simple.Validator{ValidateFunc: config.validate}
	a, err := simple.NewApp(simple.AppConfig{
		Name:       "preferences",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					klog.ErrorS(err, "Informer processing error")
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{Kind: v1.PreferencesKind(), Validator: validator},
			{Kind: v1alpha1.PreferencesKind(), Validator: validator},
		},
	})
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}
