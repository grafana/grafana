package app

import (
	"errors"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/alertenrichment/pkg/generated/alertenrichment/v1beta1"
)

// New creates the alertenrichment app.
func New(cfg app.Config) (app.App, error) {
	// TODO: define and validate a specific config (cfg.SpecificConfig), if needed.

	c := simple.AppConfig{
		Name:       "alertenrichment",
		KubeConfig: cfg.KubeConfig,
		// TODO: set InformerConfig.
		// TODO: register converters, if more than one version exists.
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: v1beta1.AlertEnrichmentKind(),
				// TODO: add Validator and Mutator.
			},
		},
	}

	a, err := simple.NewApp(c)
	if err != nil {
		return nil, err
	}

	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, errors.Join(errors.New("invalid manifest"), err)
	}

	return a, nil
}
