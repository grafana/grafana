package app

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	examplev0alpha1 "github.com/grafana/grafana/apps/example/pkg/apis/example/v0alpha1"
	examplev1alpha1 "github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
)

// New creates a new instance of the Example App. It gets called after the app's APIs have been registered,
// and is used for routing non-storage API requests, admission control, conversion, and can run
// reconcilers on kinds.
func New(cfg app.Config) (app.App, error) {
	// APIPath needs to be set to `/apis`, as it defaults to empty
	cfg.KubeConfig.APIPath = "/apis"
	// We create a client to work with our Example kind in our reconciler
	client, err := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig()).ClientFor(examplev1alpha1.ExampleKind())
	if err != nil {
		return nil, fmt.Errorf("unable to create example client: %w", err)
	}
	var reconciler operator.Reconciler
	exampleConfig, ok := cfg.SpecificConfig.(*ExampleConfig)
	if ok && exampleConfig.EnableReconciler {
		reconciler = NewExampleReconciler(client)
		// Set the default logger if the reconciler is enabled--this should be done in grafana's API server handling instead,
		// and will be corrected in a future PR
		logging.DefaultLogger = logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug, // Temporarily hardcoded to debug for the example
		}))
	}

	// This is the configuration for our App.
	simpleConfig := simple.AppConfig{
		Name:       "example",
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
				Kind: examplev0alpha1.ExampleKind(),
				// Validator is run on ingress and is it returns an error the request is rejected
				Validator: NewValidator(),
				// Mutator is run on ingress and makes changes to the input object
				Mutator: NewMutator(),
			},
			{
				Kind: examplev1alpha1.ExampleKind(),
				// We only want the reconciler on one version of our kind, and it's usually best to use the latest
				// We'll receive events for every example object, regardless of version used in the API,
				// it will convert them to the version used for the reconciler.
				Reconciler: reconciler,
				// By default, reconcilers for ManagedKinds are wrapped in
				ReconcileOptions: simple.BasicReconcileOptions{
					// Namespace is the namespace your reconciler will watch.
					// It defaults to all, so this isn't necessary to specify the way we do here.
					Namespace: resource.NamespaceAll,
					// We can optionally filter our reconciler to only get events for Example resources which
					// satisfy the following label filters
					// LabelFilters: []string{"foo=bar"},
					// By default, reconcilers for ManagedKinds are wrapped in the app-sdk's OpinionatedReconciler.
					// To turn this functionality off, you can set UsePlain to false
					// UsePlain: true,
				},
				// Validator is run on ingress and is it returns an error the request is rejected
				Validator: NewValidator(),
				// Mutator is run on ingress and makes changes to the input object
				Mutator: NewMutator(),
				// We defined this route in our CUE, but we need to actually define the HTTP handler for it.
				CustomRoutes: simple.AppCustomRouteHandlers{
					{
						Path:   "foo",
						Method: "GET",
					}: ExampleGetFooHandler,
				},
			},
		},
		// Conversion for kinds is defined for all versions of a kind at once.
		// This interface may change in the future, see https://github.com/grafana/grafana-app-sdk/issues/617
		Converters: map[schema.GroupKind]simple.Converter{
			{
				Group: cfg.ManifestData.Group,
				Kind:  examplev0alpha1.ExampleKind().Kind(),
			}: NewExampleConverter(),
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
				{
					Namespaced: false,
					Path:       "other",
					Method:     "GET",
				}: GetOtherHandler,
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
	gv := schema.GroupVersion{
		Group:   examplev1alpha1.ExampleKind().Group(),
		Version: examplev1alpha1.ExampleKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {examplev1alpha1.ExampleKind()},
	}
}
