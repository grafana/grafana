package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
	"github.com/grafana/grafana/pkg/services/authz"
)

var appManifestData = app.ManifestData{
	AppName: "iam-folder-reconciler",
	Group:   "iam.grafana.app",
}

type AppConfig struct {
	ZanzanaCfg                authz.ZanzanaClientConfig
	FolderReconcilerNamespace string
}

func Provider(appCfg app.SpecificConfig) app.Provider {
	return simple.NewAppProvider(app.NewEmbeddedManifest(appManifestData), appCfg, New)
}

func New(cfg app.Config) (app.App, error) {
	appSpecificConfig, ok := cfg.SpecificConfig.(AppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected AppConfig, got %T", cfg.SpecificConfig)
	}

	folderReconciler, err := reconcilers.NewFolderReconciler(reconcilers.ReconcilerConfig{
		ZanzanaCfg:                appSpecificConfig.ZanzanaCfg,
		KubeConfig:                &cfg.KubeConfig,
		FolderReconcilerNamespace: appSpecificConfig.FolderReconcilerNamespace,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create FolderReconciler: %w", err)
	}

	logging.DefaultLogger.Info("FolderReconciler created")

	reconcilerOptions := simple.BasicReconcileOptions{}

	if cfg.SpecificConfig.(AppConfig).FolderReconcilerNamespace != "" {
		reconcilerOptions.Namespace = cfg.SpecificConfig.(AppConfig).FolderReconcilerNamespace
	}

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
				Kind:             foldersKind.FolderKind(),
				Reconciler:       folderReconciler,
				ReconcileOptions: reconcilerOptions,
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
