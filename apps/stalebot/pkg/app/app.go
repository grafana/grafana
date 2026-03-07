package app

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/stalebot/pkg/apis/stalebot/v1alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// New is the entry point for the stalebot app
// It is called by the Grafana app SDK after APIs are registered
func New(cfg app.Config) (app.App, error) {
	// Ensure we use the correct API path
	cfg.KubeConfig.APIPath = "/apis"

	// Get app-specific config
	appConfig, ok := cfg.SpecificConfig.(*Config)
	if !ok {
		appConfig = &Config{
			DefaultStaleDaysThreshold: 30,
			CheckIntervalMinutes:      60,
			EnableNotifications:       false,
		}
	}

	// Configure the simple app
	simpleConfig := simple.AppConfig{
		Name:       "stalebot",
		KubeConfig: cfg.KubeConfig,

		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:       v1alpha1.StaleDashboardTrackerKind(),
				Validator:  NewValidator(),
				Mutator:    NewMutator(appConfig),
				Reconciler: NewReconciler(appConfig),
			},
		},
	}

	// Create the app
	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	// Validate against manifest
	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

// GetKinds returns the kinds served by this app
func GetKinds() map[schema.GroupVersion][]runtime.Object {
	return map[schema.GroupVersion][]runtime.Object{
		{Group: "stalebot.grafana.app", Version: "v1alpha1"}: {
			&v1alpha1.StaleDashboardTracker{},
		},
	}
}
