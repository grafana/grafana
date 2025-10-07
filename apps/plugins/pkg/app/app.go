package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	appk8s "github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsapi "github.com/grafana/grafana/apps/plugins/pkg/apis"
	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/reconcilers"
)

// PluginsAppConfig holds configuration for the plugins app
type PluginsAppConfig struct {
	// PluginInstaller adapter for installing/removing plugins
	PluginInstaller reconcilers.PluginInstaller
	// PluginRegistry adapter for querying installed plugins
	PluginRegistry reconcilers.PluginRegistry
	// InstallClient is the client for PluginInstall resources
	InstallClient *pluginsv0alpha1.PluginInstallClient
	// GrafanaVersion is the Grafana build version
	GrafanaVersion string
	// NodeName is this pod's identifier (optional, defaults to HOSTNAME env var)
	NodeName string
	// EnableReconciler controls whether to enable the PluginInstall reconciler
	EnableReconciler bool
}

// createPluginInstallReconciler creates a PluginInstall reconciler if enabled in the config
func createPluginInstallReconciler(cfg app.Config) (operator.Reconciler, error) {
	appConfig, ok := cfg.SpecificConfig.(*PluginsAppConfig)
	if !ok || !appConfig.EnableReconciler {
		return nil, nil
	}

	// Validate required dependencies
	if appConfig.PluginInstaller == nil {
		return nil, fmt.Errorf("PluginInstaller is required when EnableReconciler is true")
	}
	if appConfig.PluginRegistry == nil {
		return nil, fmt.Errorf("PluginRegistry is required when EnableReconciler is true")
	}

	// Create InstallClient if not provided
	installClient := appConfig.InstallClient
	if installClient == nil {
		clientGenerator := appk8s.NewClientRegistry(cfg.KubeConfig, appk8s.ClientConfig{})
		var err error
		installClient, err = pluginsv0alpha1.NewPluginInstallClientFromGenerator(clientGenerator)
		if err != nil {
			return nil, fmt.Errorf("failed to create PluginInstall client: %w", err)
		}
	}

	reconciler, err := reconcilers.NewPluginInstallReconciler(reconcilers.ReconcilerConfig{
		PluginInstaller: appConfig.PluginInstaller,
		PluginRegistry:  appConfig.PluginRegistry,
		InstallClient:   installClient,
		GrafanaVersion:  appConfig.GrafanaVersion,
		NodeName:        appConfig.NodeName,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create PluginInstall reconciler: %w", err)
	}

	logging.DefaultLogger.Info("PluginInstall reconciler created", "nodeName", appConfig.NodeName)
	return reconciler, nil
}

func New(cfg app.Config) (app.App, error) {
	// Create reconciler if enabled
	pluginInstallReconciler, err := createPluginInstallReconciler(cfg)
	if err != nil {
		return nil, err
	}
	cfg.KubeConfig.APIPath = "apis"

	simpleConfig := simple.AppConfig{
		Name:       "plugins",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:       pluginsv0alpha1.PluginInstallKind(),
				Reconciler: pluginInstallReconciler,
			},
			{
				Kind: pluginsv0alpha1.PluginMetaKind(),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	kinds := make(map[schema.GroupVersion][]resource.Kind)
	manifest := pluginsapi.LocalManifest()
	for _, v := range manifest.ManifestData.Versions {
		gv := schema.GroupVersion{
			Group:   manifest.ManifestData.Group,
			Version: v.Name,
		}
		for _, k := range v.Kinds {
			kind, ok := pluginsapi.ManifestGoTypeAssociator(k.Kind, v.Name)
			if ok {
				kinds[gv] = append(kinds[gv], kind)
			}
		}
	}
	return kinds
}
