package app

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	liveV1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
)

type LiveConfig struct {
	Enable bool
}

func New(cfg app.Config) (app.App, error) {
	// APIPath needs to be set to `/apis`, as it defaults to empty
	cfg.KubeConfig.APIPath = "/apis"
	// // We create a client to work with our Example kind in our reconciler
	// client, err := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig()).ClientFor(liveV1.ChannelKind())
	// if err != nil {
	// 	return nil, fmt.Errorf("unable to create example client: %w", err)
	// }
	// exampleConfig, ok := cfg.SpecificConfig.(*LiveConfig)
	// if ok {
	// 	fmt.Printf("CONFIG: %+v. // %v\n", exampleConfig, client)
	// }

	// This is the configuration for our App.
	simpleConfig := simple.AppConfig{
		Name:       "live",
		KubeConfig: cfg.KubeConfig,
		// ManagedKinds is the list of all kinds our app manages (the kinds owned by our app).
		// Here, a Kind is defined as a distinct Group, Version, and Kind combination,
		// so for each version of our Example kind, we need to add it to this list.
		// Each kind can also have admission control attached to it--different versions can have different admission control attached.
		// Handlers for custom routes defined in the manifest for the kind go here--this is where they actuall get routed,
		// they are only defined in the manifest.
		// Reconcilers and/or Watchers are also attached here, though they should only be attached to a single version per kind.
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: liveV1.ChannelKind(),
			},
		},
		// VersionedCustomRoutes are the custom route handlers for routes defined at the version level of the manifest
		// instead of for a specific kind. This are sometimes referred to as "resource routes"
		// (as opposed to "subresource routes" which are attached to kinds).
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v1alpha1": {
				{
					Namespaced: true,
					Path:       "something",
					Method:     "GET",
				}: GetSomethingHandler,
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	// This makes it easier to catch problems at startup, rather than when something doesn't behave as expected.
	// ValidateManifest will ensure that the capabilities you define in your simple.AppConfig
	// match the capabilities described in the AppManifest.
	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	return map[schema.GroupVersion][]resource.Kind{
		liveV1.GroupVersion: {
			liveV1.ChannelKind(),
		},
	}
}
