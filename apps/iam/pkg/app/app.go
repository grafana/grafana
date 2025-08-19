package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/apis"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
)

type AppConfig = reconcilers.AppConfig

func Provider(appCfg AppConfig) app.Provider {
	return simple.NewAppProvider(apis.LocalManifest(), appCfg, New)
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
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: v0alpha1.GlobalRoleKind(),
			},
			{
				Kind: v0alpha1.GlobalRoleBindingKind(),
			},
			{
				Kind: v0alpha1.CoreRoleKind(),
			},
			{
				Kind: v0alpha1.RoleKind(),
			},
			{
				Kind: v0alpha1.RoleBindingKind(),
			},
			{
				Kind: v0alpha1.ResourcePermissionKind(),
			},
			{
				Kind: v0alpha1.UserKind(),
			},
			{
				Kind: v0alpha1.TeamKind(),
			},
			{
				Kind: v0alpha1.TeamBindingKind(),
			},
			{
				Kind: v0alpha1.ServiceAccountKind(),
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
