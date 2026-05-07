package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
)

func New(cfg app.Config) (app.App, error) {
	customCfg, ok := cfg.SpecificConfig.(*Config)
	if !ok {
		return nil, errors.New("no configuration")
	}
	if err := customCfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	converter := &identityConverter{}
	apiGroup := v1beta1.ReceiverKind().Group()

	c := simple.AppConfig{
		Name:       "alerting.notification",
		KubeConfig: cfg.KubeConfig,
		Converters: map[schema.GroupKind]simple.Converter{
			{Group: apiGroup, Kind: v1beta1.ReceiverKind().Kind()}:       converter,
			{Group: apiGroup, Kind: v1beta1.RoutingTreeKind().Kind()}:    converter,
			{Group: apiGroup, Kind: v1beta1.TemplateGroupKind().Kind()}:  converter,
			{Group: apiGroup, Kind: v1beta1.TimeIntervalKind().Kind()}:   converter,
			{Group: apiGroup, Kind: v1beta1.InhibitionRuleKind().Kind()}: converter,
		},
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.DefaultLogger.With("error", err).Error("Informer processing error")
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{Kind: v0alpha1.InhibitionRuleKind()},
			{
				Kind: v0alpha1.ReceiverKind(),
				CustomRoutes: map[simple.AppCustomRoute]simple.AppCustomRouteHandler{
					{
						Method: simple.AppCustomRouteMethodPost,
						Path:   "test",
					}: customCfg.ReceiverTestingHandler.HandleReceiverTestingRequest,
				},
			},
			{Kind: v0alpha1.RoutingTreeKind()},
			{Kind: v0alpha1.TemplateGroupKind()},
			{Kind: v0alpha1.TimeIntervalKind()},
			{Kind: v1beta1.InhibitionRuleKind()},
			{
				Kind: v1beta1.ReceiverKind(),
				CustomRoutes: map[simple.AppCustomRoute]simple.AppCustomRouteHandler{
					{
						Method: simple.AppCustomRouteMethodPost,
						Path:   "test",
					}: customCfg.ReceiverTestingHandler.HandleReceiverTestingRequest,
				},
			},
			{Kind: v1beta1.RoutingTreeKind()},
			{Kind: v1beta1.TemplateGroupKind()},
			{Kind: v1beta1.TimeIntervalKind()},
		},
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v0alpha1": {
				{
					Namespaced: true,
					Path:       "/integrationtypeschemas",
					Method:     "GET",
				}: customCfg.IntegrationTypeSchemaHandler.HandleGetSchemas,
			},
			"v1beta1": {
				{
					Namespaced: true,
					Path:       "/integrationtypeschemas",
					Method:     "GET",
				}: customCfg.IntegrationTypeSchemaHandler.HandleGetSchemas,
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
