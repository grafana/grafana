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

func buildKindValidator(kind resource.Kind, cfg config.RuntimeConfig) *simple.Validator {
	switch kind.Kind() {
	case "AlertRule":
		return alertrule.NewValidator(cfg)
	case "RecordingRule":
		return recordingrule.NewValidator(cfg)
	}
	return nil
}

func buildKindMutator(kind resource.Kind, cfg config.RuntimeConfig) *simple.Mutator {
	switch kind.Kind() {
	case "AlertRule":
		return alertrule.NewMutator(cfg)
	case "RecordingRule":
		return recordingrule.NewMutator(cfg)
	}
	return nil
}
