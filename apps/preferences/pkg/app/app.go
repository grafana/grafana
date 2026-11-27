package app

import (
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/simple"
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

// New builds the preferences app, which validates preferences. The app's own
// configuration is a *Config; without one the app has no defaults.
//
// It also answers preferences/merged, the one name of the kind no object is
// stored under, with the caller's preferences merged.
func New(cfg app.Config) (app.App, error) {
	config, ok := cfg.SpecificConfig.(*Config)
	if !ok || config == nil {
		config = &Config{}
	}

	merged := &mergedRoute{config: config}
	if cfg.KubeConfig.Host != "" {
		client, err := v1.NewPreferencesClientFromGenerator(k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{}))
		if err != nil {
			return nil, fmt.Errorf("creating the preferences client: %w", err)
		}
		merged.lister = client
	}
	mergedRoutes := simple.AppVersionRouteHandlers{
		{Namespaced: true, Path: mergedPath, Method: simple.AppCustomRouteMethodGet}: merged.get,
	}

	validator := &simple.Validator{ValidateFunc: config.validate}
	a, err := simple.NewApp(simple.AppConfig{
		Name:       "preferences",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{Kind: v1.PreferencesKind(), Validator: validator},
			{Kind: v1alpha1.PreferencesKind(), Validator: validator},
		},
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			v1.APIVersion:       mergedRoutes,
			v1alpha1.APIVersion: mergedRoutes,
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
