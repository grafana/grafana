package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis"
	rulesextv0 "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/prometheusrulefile"
	alertingv0 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

// New wires up the rules-extensions app: validator + opinionated reconciler for PrometheusRuleFile.
// The reconciler creates a Folder per group and an AlertRule / RecordingRule per rule entry; the
// SDK's OpinionatedReconciler wrapping (enabled by default for ManagedKinds) takes care of
// attaching and removing a finalizer so deletes are not lost across operator restarts.
func New(cfg app.Config) (app.App, error) {
	runtimeCfg, ok := cfg.SpecificConfig.(config.RuntimeConfig)
	if !ok {
		return nil, config.ErrInvalidRuntimeConfig
	}

	// Build clients for every kind the reconciler touches. We use the same KubeConfig the app
	// was configured with, since all kinds live in the same API server. The PrometheusRuleFile
	// client is needed to update the file's status subresource with the inventory of children
	// we manage on its behalf.
	clients := k8s.NewClientRegistry(cfg.KubeConfig, k8s.DefaultClientConfig())
	filesClient, err := clients.ClientFor(rulesextv0.PrometheusRuleFileKind())
	if err != nil {
		return nil, fmt.Errorf("build PrometheusRuleFile client: %w", err)
	}
	folderClient, err := clients.ClientFor(folderv1.FolderKind())
	if err != nil {
		return nil, fmt.Errorf("build folder client: %w", err)
	}
	alertRuleClient, err := clients.ClientFor(alertingv0.AlertRuleKind())
	if err != nil {
		return nil, fmt.Errorf("build alert rule client: %w", err)
	}
	recordingRuleClient, err := clients.ClientFor(alertingv0.RecordingRuleKind())
	if err != nil {
		return nil, fmt.Errorf("build recording rule client: %w", err)
	}

	reconciler, err := prometheusrulefile.NewReconciler(runtimeCfg, filesClient, folderClient, alertRuleClient, recordingRuleClient)
	if err != nil {
		return nil, fmt.Errorf("build reconciler: %w", err)
	}

	// Walk apis.GetKinds() to assemble ManagedKinds — mirrors the pattern in apps/alerting/rules
	// so the two apps stay structurally similar.
	var managedKinds []simple.AppManagedKind
	for _, kinds := range apis.GetKinds() {
		for _, kind := range kinds {
			managedKinds = append(managedKinds, simple.AppManagedKind{
				Kind:      kind,
				Validator: prometheusrulefile.NewValidator(runtimeCfg),
				// Leaving ReconcileOptions.UsePlain at its zero (false) value means the SDK
				// wraps our Reconciler in an OpinionatedReconciler, which adds/removes the
				// finalizer for us so deletes survive operator downtime.
				Reconciler: reconciler,
			})
		}
	}

	simpleCfg := simple.AppConfig{
		Name:       "alerting.rules-extensions",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.DefaultLogger.With("error", err).Error("Informer processing error")
				},
			},
		},
		ManagedKinds: managedKinds,
	}

	a, err := simple.NewApp(simpleCfg)
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}
