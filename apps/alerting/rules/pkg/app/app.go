package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/alertrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/recordingrule"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/rulesequence"
)

func New(cfg app.Config) (app.App, error) {
	managedKinds := make([]simple.AppManagedKind, 0)
	runtimeCfg, ok := cfg.SpecificConfig.(config.RuntimeConfig)
	if !ok {
		return nil, config.ErrInvalidRuntimeConfig
	}
	for _, kinds := range apis.GetKinds() {
		for _, kind := range kinds {
			managedKind := simple.AppManagedKind{
				Kind:      kind,
				Validator: buildKindValidator(kind, runtimeCfg),
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
		ManagedKinds:          managedKinds,
		VersionedCustomRoutes: buildSearchRoutes(runtimeCfg),
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

// buildSearchRoutes wires the rule search handlers (provided by the registry)
// to their namespaced custom routes. Routes whose handler is unset are skipped
// so manifest validation without a backing instance does not register nil
// handlers.
func buildSearchRoutes(cfg config.RuntimeConfig) map[string]simple.AppVersionRouteHandlers {
	handlers := simple.AppVersionRouteHandlers{}
	add := func(path string, handler simple.AppCustomRouteHandler) {
		if handler != nil {
			handlers[simple.AppVersionRoute{Namespaced: true, Path: path, Method: simple.AppCustomRouteMethodGet}] = handler
		}
	}
	add("/search", cfg.SearchRulesHandler)
	add("/search/alertrules", cfg.SearchAlertRulesHandler)
	add("/search/recordingrules", cfg.SearchRecordingRulesHandler)
	if len(handlers) == 0 {
		return nil
	}
	return map[string]simple.AppVersionRouteHandlers{"v0alpha1": handlers}
}

func buildKindValidator(kind resource.Kind, cfg config.RuntimeConfig) *simple.Validator {
	switch kind.Kind() {
	case "AlertRule":
		return alertrule.NewValidator(cfg)
	case "RecordingRule":
		return recordingrule.NewValidator(cfg)
	case "RuleSequence":
		return rulesequence.NewValidator(cfg)
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
