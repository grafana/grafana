package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
)

// New builds the collections app. Its kube client is made the way an external
// app's is, so the update route acts as the caller through the request context.
func New(cfg app.Config) (app.App, error) {
	routes := &starsRoutes{}
	if cfg.KubeConfig.Host != "" {
		client, err := v1alpha1.NewStarsClientFromGenerator(k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{}))
		if err != nil {
			return nil, fmt.Errorf("creating the stars client: %w", err)
		}
		routes.client = client
	}

	a, err := simple.NewApp(simple.AppConfig{
		Name:       "collections",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{{
			Kind:      v1alpha1.StarsKind(),
			Mutator:   &simple.Mutator{MutateFunc: mutateStars},
			Validator: &simple.Validator{ValidateFunc: validateStars},
			CustomRoutes: simple.AppCustomRouteHandlers{
				{Path: starsUpdatePath, Method: simple.AppCustomRouteMethodPut}:    routes.update,
				{Path: starsUpdatePath, Method: simple.AppCustomRouteMethodDelete}: routes.update,
			},
		}},
	})
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}

func mutateStars(_ context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	stars, ok := req.Object.(*v1alpha1.Stars)
	if !ok {
		return nil, fmt.Errorf("expected a stars object: (%T)", req.Object)
	}
	stars.Spec.Normalize()
	return &app.MutatingResponse{UpdatedObject: stars}, nil
}

// validateStars accepts everything: the schema decides what a valid object is.
func validateStars(context.Context, *app.AdmissionRequest) error { return nil }
