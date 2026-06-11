package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/alertrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/recordingrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/rulesequence"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/schemavalidation"
)

func New(cfg app.Config) (app.App, error) {
	managedKinds := make([]simple.AppManagedKind, 0)
	runtimeCfg, ok := cfg.SpecificConfig.(config.RuntimeConfig)
	if !ok {
		return nil, config.ErrInvalidRuntimeConfig
	}

	specValidators, err := schemavalidation.BuildAll(cfg.ManifestData, schema.GroupVersion{
		Group: cfg.ManifestData.Group,
		// TODO: handle multiple versions
		Version: cfg.ManifestData.Versions[0].Name,
	})
	if err != nil {
		return nil, err
	}
	for _, kinds := range apis.GetKinds() {
		for _, kind := range kinds {
			managedKind := simple.AppManagedKind{
				Kind:      kind,
				Validator: buildKindValidator(kind, runtimeCfg, specValidators[kind.Kind()]),
				Mutator:   buildKindMutator(kind, runtimeCfg),
				Watcher:   buildKindWatcher(kind, runtimeCfg),
			}
			// Only kinds with a watcher run an informer (RuleSequence), so this
			// scopes that watch to WatchNamespace; empty means all namespaces.
			if managedKind.Watcher != nil && runtimeCfg.WatchNamespace != "" {
				managedKind.ReconcileOptions.Namespace = runtimeCfg.WatchNamespace
			}
			managedKinds = append(managedKinds, managedKind)
		}
	}

	c := simple.AppConfig{
		Name:       "alerting.rules",
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

	a, err := simple.NewApp(c)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func buildKindValidator(kind resource.Kind, cfg config.RuntimeConfig, sv *schemavalidation.SpecValidator) *simple.Validator {
	switch kind.Kind() {
	case "AlertRule":
		return alertrule.NewValidator(cfg, sv)
	case "RecordingRule":
		return recordingrule.NewValidator(cfg, sv)
	case "RuleSequence":
		return rulesequence.NewValidator(cfg, sv)
	}
	return nil
}

func buildKindMutator(kind resource.Kind, cfg config.RuntimeConfig) *simple.Mutator {
	switch kind.Kind() {
	case "AlertRule":
		return alertrule.NewMutator(cfg)
	case "RecordingRule":
		return recordingrule.NewMutator(cfg)
	case "RuleSequence":
		return rulesequence.NewMutator(cfg)
	}
	return nil
}

func buildKindWatcher(kind resource.Kind, cfg config.RuntimeConfig) operator.ResourceWatcher {
	switch kind.Kind() {
	case "RuleSequence":
		if idx, ok := cfg.MembershipResolver.(*rulesequence.MembershipIndex); ok {
			return idx
		}
	}
	return nil
}
