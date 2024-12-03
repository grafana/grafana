package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	feedbackv0alpha1 "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	"github.com/grafana/grafana/apps/feedback/pkg/watchers"
)

func New(cfg app.Config) (app.App, error) {
	feedbackWatcher, err := watchers.NewFeedbackWatcher()
	if err != nil {
		return nil, fmt.Errorf("unable to create FeedbackWatcher: %w", err)
	}

	config := simple.AppConfig{
		Name:       "feedback",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				// FIXME: add your own error handling here
				logging.FromContext(ctx).With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:    feedbackv0alpha1.FeedbackKind(),
				Watcher: feedbackWatcher,
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
						// do something here if needed
						return nil
					},
				},
			},
		},
	}

	// Create the App
	a, err := simple.NewApp(config)
	if err != nil {
		return nil, err
	}

	// Validate the capabilities against the provided manifest to make sure there isn't a mismatch
	err = a.ValidateManifest(cfg.ManifestData)
	return a, err
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   feedbackv0alpha1.FeedbackKind().Group(),
		Version: feedbackv0alpha1.FeedbackKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {feedbackv0alpha1.FeedbackKind()},
	}
}
