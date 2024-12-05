package app

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	feedbackv0alpha1 "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	"github.com/grafana/grafana/apps/feedback/pkg/watchers"
	"github.com/grafana/grafana/pkg/setting"
)

type FeedbackConfig struct {
	GrafanaCfg *setting.Cfg
}

func New(cfg app.Config) (app.App, error) {
	feedbackCfg, ok := cfg.SpecificConfig.(FeedbackConfig)
	if !ok {
		return nil, fmt.Errorf("expected %s but received %s", reflect.TypeOf(FeedbackConfig{}).String(), reflect.TypeOf(feedbackCfg).String()) // not sure if necessary
	}

	// blind copy pasta
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})

	feedbackStore, err := resource.NewTypedStore[*feedbackv0alpha1.Feedback](feedbackv0alpha1.FeedbackKind(), clientGenerator)
	if err != nil {
		return nil, err
	}

	feedbackWatcher, err := watchers.NewFeedbackWatcher(feedbackCfg.GrafanaCfg, feedbackStore)
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
						feedback, ok := req.Object.(*feedbackv0alpha1.Feedback)
						if !ok {
							logging.FromContext(ctx).Error("received admission request for validator that is not of feedback type")

							return nil
						}

						if feedback.Spec.Message == "" {
							return fmt.Errorf("message cannot be empty")
						}

						if feedback.Spec.ScreenshotUrl != nil && *feedback.Spec.ScreenshotUrl != "" && len(feedback.Spec.Screenshot) > 0 {
							return fmt.Errorf("screenshot and screenshot url cannot be both filled in at the same time")
						}

						if feedback.Spec.CanContactReporter && feedback.Spec.ReporterEmail == nil {
							logging.FromContext(ctx).Warn("user requested we contact them, but email is missing")
						}

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
