package app

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/reconcilers"
	"github.com/grafana/grafana/pkg/services/authz"
)

var appManifestData = app.ManifestData{
	AppName: "iam-folder-reconciler",
	Group:   "iam.grafana.app",
}

type InformerConfig struct {
	MaxConcurrentWorkers uint64
}

type AppConfig struct {
	ZanzanaClientCfg  authz.ZanzanaClientConfig
	InformerConfig    InformerConfig
	Namespace         string
	MetricsRegisterer prometheus.Registerer
}

func Provider(appCfg app.SpecificConfig) app.Provider {
	return simple.NewAppProvider(app.NewEmbeddedManifest(appManifestData), appCfg, New)
}

func generateInformerSupplier(informerConfig InformerConfig, metrics *reconcilers.ReconcilerMetrics) simple.InformerSupplier {
	return func(kind resource.Kind, clients resource.ClientGenerator, options operator.InformerOptions) (operator.Informer, error) {
		client, err := clients.ClientFor(kind)
		if err != nil {
			return nil, err
		}

		informer, err := operator.NewKubernetesBasedInformer(
			kind, client,
			options,
		)
		if err != nil {
			return nil, err
		}

		//nolint:staticcheck
		return operator.NewConcurrentInformer(
			informer,
			operator.ConcurrentInformerOptions{
				MaxConcurrentWorkers: informerConfig.MaxConcurrentWorkers,
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).With("error", err).Error("ConcurrentInformer processing error")
					if metrics != nil {
						// Use "unknown" for action since informer errors don't have specific actions
						metrics.RecordReconcileFailure("unknown", "informer")
					}
				},
			},
		)
	}
}

func New(cfg app.Config) (app.App, error) {
	appSpecificConfig, ok := cfg.SpecificConfig.(AppConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected AppConfig, got %T", cfg.SpecificConfig)
	}

	// Initialize metrics first so they can be shared across components
	metrics := reconcilers.NewReconcilerMetrics(appSpecificConfig.MetricsRegisterer, appSpecificConfig.Namespace)

	folderReconciler, err := reconcilers.NewFolderReconciler(reconcilers.ReconcilerConfig{
		ZanzanaCfg: appSpecificConfig.ZanzanaClientCfg,
		Metrics:    metrics,
	}, appSpecificConfig.MetricsRegisterer)
	if err != nil {
		return nil, fmt.Errorf("unable to create FolderReconciler: %w", err)
	}

	logging.DefaultLogger.Info("FolderReconciler created")

	config := simple.AppConfig{
		Name:       cfg.ManifestData.AppName,
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerSupplier: generateInformerSupplier(appSpecificConfig.InformerConfig, metrics),
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).With("error", err).Error("Informer processing error")
					if metrics != nil {
						// Use "unknown" for action since top-level informer errors don't have specific actions
						metrics.RecordReconcileFailure("unknown", "informer")
					}
				},
			},
		},
		UnmanagedKinds: []simple.AppUnmanagedKind{
			{
				Kind:       foldersKind.FolderKind(),
				Reconciler: folderReconciler,
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
