package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	managedKinds := make([]simple.AppManagedKind, 0)
	for _, kinds := range apis.GetKinds() {
		for _, kind := range kinds {
			managedKinds = append(managedKinds, simple.AppManagedKind{Kind: kind})
		}
	}

	customCfg, ok := cfg.SpecificConfig.(*Config)
	if !ok {
		return nil, errors.New("no configuration")
	}
	if err := customCfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	c := simple.AppConfig{
		Name:       "alerting.notification",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.DefaultLogger.With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: managedKinds,
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			v0alpha1.APIVersion: {
				simple.AppVersionRoute{
					Namespaced: true,
					Path:       v0alpha1.ReceiverTestingResource,
					Method:     "POST",
				}: customCfg.ReceiverTestingHandler.HandleReceiverTestingRequest,
			},
		},
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
