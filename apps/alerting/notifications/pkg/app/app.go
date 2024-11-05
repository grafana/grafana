package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/simple"

	receiverv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/receiver/v0alpha1"
	routingtreev0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/routingtree/v0alpha1"
	templategroupv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/templategroup/v0alpha1"
	timeintervalv0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	c := simple.AppConfig{
		Name:       "alerting.notification",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				logging.DefaultLogger.With("error", err).Error("Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: receiverv0alpha1.Kind(),
			},
			{
				Kind: routingtreev0alpha1.Kind(),
			},
			{
				Kind: timeintervalv0alpha1.Kind(),
			},
			{
				Kind: templategroupv0alpha1.Kind(),
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
