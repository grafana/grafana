package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
)

type AppConfig = reconcilers.AppConfig

var appManifestData = app.ManifestData{
	AppName: "iam-folder-reconciler",
	Group:   "iam.grafana.app",
}

func Provider(appCfg AppConfig) app.Provider {
	return simple.NewAppProvider(app.NewEmbeddedManifest(appManifestData), appCfg, New)
}

func New(cfg app.Config) (app.App, error) {
	folderReconciler, err := reconcilers.NewFolderReconciler(cfg)
	if err != nil {
		return nil, fmt.Errorf("unable to create FolderReconciler: %w", err)
	}

	logging.DefaultLogger.Info("FolderReconciler created")

	config := simple.AppConfig{
		Name:       cfg.ManifestData.AppName,
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				// FIXME: add your own error handling here
				logging.FromContext(ctx).With("error", err).Error("Informer processing error")
			},
		},
		UnmanagedKinds: []simple.AppUnmanagedKind{
			{
				Kind:       foldersKind.FolderKind(),
				Reconciler: folderReconciler,
				ReconcileOptions: simple.BasicReconcileOptions{
					Namespace: cfg.SpecificConfig.(AppConfig).FolderReconcilerNamespace,
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
