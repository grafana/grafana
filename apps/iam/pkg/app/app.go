package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/iam/pkg/apis"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/apps/iam/pkg/watchers"
)

func Provider(appCfg app.SpecificConfig) app.Provider {
	return simple.NewAppProvider(apis.LocalManifest(), appCfg, New)
}

func New(cfg app.Config) (app.App, error) {
	resourcepermissionWatcher, err := watchers.NewResourcePermissionWatcher()
	if err != nil {
		return nil, fmt.Errorf("unable to create ResourcePermissionWatcher: %w", err)
	}

	config := simple.AppConfig{
		Name:       "iam",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				// FIXME: add your own error handling here
				logging.FromContext(ctx).With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:    v0alpha1.ResourcePermissionKind(),
				Watcher: resourcepermissionWatcher,
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
