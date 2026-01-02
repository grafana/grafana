package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	validatorv1alpha1 "github.com/grafana/grafana/apps/dashvalidator/pkg/apis/dashvalidator/v1alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

type DashValidatorConfig struct {
	DatasourceSvc datasources.DataSourceService
	PluginCtx     *plugincontext.Provider
}

func New(cfg app.Config) (app.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*DashValidatorConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected DashValidatorConfig")
	}

	log := logging.DefaultLogger.With("app", "dashvalidator")

	// configure our app
	simpleConfig := simple.AppConfig{
		Name:       "dashvalidator",
		KubeConfig: cfg.KubeConfig,

		//Define our custom route
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v1alpha1": {
				{
					Namespaced: true,
					Path:       "check",
					Method:     "POST",
				}: handleCheckRoute(log, specificConfig.DatasourceSvc, specificConfig.PluginCtx),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create app: %w", err)
	}

	return a, nil
}

// custom route handler to check dashboard compatibility
func handleCheckRoute(
	log logging.Logger,
	datasourceSvc datasources.DataSourceService,
	pluginCtx *plugincontext.Provider,
) func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {

	return func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
		logger := log.WithContext(ctx)
		logger.Info("Received compatibility check request")

		// TODO validation logic here

		// for now a simple response

		w.WriteHeader(http.StatusOK)
		return json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Handler working!",
		})
	}
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   "dashvalidator.grafana.com",
		Version: "v1alpha1",
	}

	return map[schema.GroupVersion][]resource.Kind{
		gv: {validatorv1alpha1.DashboardCompatibilityScoreKind()},
	}
}
