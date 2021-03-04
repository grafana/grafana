// This file is safe to edit. Once it exists it will not be overwritten

package restapi

import (
	"crypto/tls"
	"net/http"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/runtime"
	"github.com/go-openapi/runtime/middleware"

	"github.com/grafana/alerting-api/pkg/gen/restapi/operations"
	"github.com/grafana/alerting-api/pkg/gen/restapi/operations/alertmanager"
	"github.com/grafana/alerting-api/pkg/gen/restapi/operations/permissions"
	"github.com/grafana/alerting-api/pkg/gen/restapi/operations/prometheus"
	"github.com/grafana/alerting-api/pkg/gen/restapi/operations/ruler"
	"github.com/grafana/alerting-api/pkg/gen/restapi/operations/testing"
)

//go:generate swagger generate server --target ../../gen --name DocumentationOfTheAPI --spec ../../../post.json --principal interface{} --exclude-main

func configureFlags(api *operations.DocumentationOfTheAPIAPI) {
	// api.CommandLineOptionsGroups = []swag.CommandLineOptionsGroup{ ... }
}

func configureAPI(api *operations.DocumentationOfTheAPIAPI) http.Handler {
	// configure the api here
	api.ServeError = errors.ServeError

	// Set your custom logger if needed. Default one is log.Printf
	// Expected interface func(string, ...interface{})
	//
	// Example:
	// api.Logger = log.Printf

	api.UseSwaggerUI()
	// To continue using redoc as your UI, uncomment the following line
	// api.UseRedoc()

	api.JSONConsumer = runtime.JSONConsumer()
	api.YamlConsumer = yamlpc.YAMLConsumer()

	api.JSONProducer = runtime.JSONProducer()

	if api.AlertmanagerRouteCreateSilenceHandler == nil {
		api.AlertmanagerRouteCreateSilenceHandler = alertmanager.RouteCreateSilenceHandlerFunc(func(params alertmanager.RouteCreateSilenceParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteCreateSilence has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteDeleteAlertingConfigHandler == nil {
		api.AlertmanagerRouteDeleteAlertingConfigHandler = alertmanager.RouteDeleteAlertingConfigHandlerFunc(func(params alertmanager.RouteDeleteAlertingConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteDeleteAlertingConfig has not yet been implemented")
		})
	}
	if api.RulerRouteDeleteNamespaceRulesConfigHandler == nil {
		api.RulerRouteDeleteNamespaceRulesConfigHandler = ruler.RouteDeleteNamespaceRulesConfigHandlerFunc(func(params ruler.RouteDeleteNamespaceRulesConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation ruler.RouteDeleteNamespaceRulesConfig has not yet been implemented")
		})
	}
	if api.RulerRouteDeleteRuleGroupConfigHandler == nil {
		api.RulerRouteDeleteRuleGroupConfigHandler = ruler.RouteDeleteRuleGroupConfigHandlerFunc(func(params ruler.RouteDeleteRuleGroupConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation ruler.RouteDeleteRuleGroupConfig has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteDeleteSilenceHandler == nil {
		api.AlertmanagerRouteDeleteSilenceHandler = alertmanager.RouteDeleteSilenceHandlerFunc(func(params alertmanager.RouteDeleteSilenceParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteDeleteSilence has not yet been implemented")
		})
	}
	if api.PrometheusRouteGetAlertStatusesHandler == nil {
		api.PrometheusRouteGetAlertStatusesHandler = prometheus.RouteGetAlertStatusesHandlerFunc(func(params prometheus.RouteGetAlertStatusesParams) middleware.Responder {
			return middleware.NotImplemented("operation prometheus.RouteGetAlertStatuses has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteGetAlertingConfigHandler == nil {
		api.AlertmanagerRouteGetAlertingConfigHandler = alertmanager.RouteGetAlertingConfigHandlerFunc(func(params alertmanager.RouteGetAlertingConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteGetAlertingConfig has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteGetAmAlertGroupsHandler == nil {
		api.AlertmanagerRouteGetAmAlertGroupsHandler = alertmanager.RouteGetAmAlertGroupsHandlerFunc(func(params alertmanager.RouteGetAmAlertGroupsParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteGetAmAlertGroups has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteGetAmAlertsHandler == nil {
		api.AlertmanagerRouteGetAmAlertsHandler = alertmanager.RouteGetAmAlertsHandlerFunc(func(params alertmanager.RouteGetAmAlertsParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteGetAmAlerts has not yet been implemented")
		})
	}
	if api.PermissionsRouteGetNamespacePermissionsHandler == nil {
		api.PermissionsRouteGetNamespacePermissionsHandler = permissions.RouteGetNamespacePermissionsHandlerFunc(func(params permissions.RouteGetNamespacePermissionsParams) middleware.Responder {
			return middleware.NotImplemented("operation permissions.RouteGetNamespacePermissions has not yet been implemented")
		})
	}
	if api.RulerRouteGetNamespaceRulesConfigHandler == nil {
		api.RulerRouteGetNamespaceRulesConfigHandler = ruler.RouteGetNamespaceRulesConfigHandlerFunc(func(params ruler.RouteGetNamespaceRulesConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation ruler.RouteGetNamespaceRulesConfig has not yet been implemented")
		})
	}
	if api.PrometheusRouteGetRuleStatusesHandler == nil {
		api.PrometheusRouteGetRuleStatusesHandler = prometheus.RouteGetRuleStatusesHandlerFunc(func(params prometheus.RouteGetRuleStatusesParams) middleware.Responder {
			return middleware.NotImplemented("operation prometheus.RouteGetRuleStatuses has not yet been implemented")
		})
	}
	if api.RulerRouteGetRulegGroupConfigHandler == nil {
		api.RulerRouteGetRulegGroupConfigHandler = ruler.RouteGetRulegGroupConfigHandlerFunc(func(params ruler.RouteGetRulegGroupConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation ruler.RouteGetRulegGroupConfig has not yet been implemented")
		})
	}
	if api.RulerRouteGetRulesConfigHandler == nil {
		api.RulerRouteGetRulesConfigHandler = ruler.RouteGetRulesConfigHandlerFunc(func(params ruler.RouteGetRulesConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation ruler.RouteGetRulesConfig has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteGetSilenceHandler == nil {
		api.AlertmanagerRouteGetSilenceHandler = alertmanager.RouteGetSilenceHandlerFunc(func(params alertmanager.RouteGetSilenceParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteGetSilence has not yet been implemented")
		})
	}
	if api.AlertmanagerRouteGetSilencesHandler == nil {
		api.AlertmanagerRouteGetSilencesHandler = alertmanager.RouteGetSilencesHandlerFunc(func(params alertmanager.RouteGetSilencesParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RouteGetSilences has not yet been implemented")
		})
	}
	if api.AlertmanagerRoutePostAlertingConfigHandler == nil {
		api.AlertmanagerRoutePostAlertingConfigHandler = alertmanager.RoutePostAlertingConfigHandlerFunc(func(params alertmanager.RoutePostAlertingConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RoutePostAlertingConfig has not yet been implemented")
		})
	}
	if api.AlertmanagerRoutePostAmAlertsHandler == nil {
		api.AlertmanagerRoutePostAmAlertsHandler = alertmanager.RoutePostAmAlertsHandlerFunc(func(params alertmanager.RoutePostAmAlertsParams) middleware.Responder {
			return middleware.NotImplemented("operation alertmanager.RoutePostAmAlerts has not yet been implemented")
		})
	}
	if api.RulerRoutePostNameRulesConfigHandler == nil {
		api.RulerRoutePostNameRulesConfigHandler = ruler.RoutePostNameRulesConfigHandlerFunc(func(params ruler.RoutePostNameRulesConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation ruler.RoutePostNameRulesConfig has not yet been implemented")
		})
	}
	if api.PermissionsRouteSetNamespacePermissionsHandler == nil {
		api.PermissionsRouteSetNamespacePermissionsHandler = permissions.RouteSetNamespacePermissionsHandlerFunc(func(params permissions.RouteSetNamespacePermissionsParams) middleware.Responder {
			return middleware.NotImplemented("operation permissions.RouteSetNamespacePermissions has not yet been implemented")
		})
	}
	if api.TestingRouteTestReceiverConfigHandler == nil {
		api.TestingRouteTestReceiverConfigHandler = testing.RouteTestReceiverConfigHandlerFunc(func(params testing.RouteTestReceiverConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation testing.RouteTestReceiverConfig has not yet been implemented")
		})
	}
	if api.TestingRouteTestRuleConfigHandler == nil {
		api.TestingRouteTestRuleConfigHandler = testing.RouteTestRuleConfigHandlerFunc(func(params testing.RouteTestRuleConfigParams) middleware.Responder {
			return middleware.NotImplemented("operation testing.RouteTestRuleConfig has not yet been implemented")
		})
	}

	api.PreServerShutdown = func() {}

	api.ServerShutdown = func() {}

	return setupGlobalMiddleware(api.Serve(setupMiddlewares))
}

// The TLS configuration before HTTPS server starts.
func configureTLS(tlsConfig *tls.Config) {
	// Make all necessary changes to the TLS configuration here.
}

// As soon as server is initialized but not run yet, this function will be called.
// If you need to modify a config, store server instance to stop it individually later, this is the place.
// This function can be called multiple times, depending on the number of serving schemes.
// scheme value will be set accordingly: "http", "https" or "unix"
func configureServer(s *http.Server, scheme, addr string) {
}

// The middleware configuration is for the handler executors. These do not apply to the swagger.json document.
// The middleware executes after routing but before authentication, binding and validation
func setupMiddlewares(handler http.Handler) http.Handler {
	return handler
}

// The middleware configuration happens before anything, this middleware also applies to serving the swagger.json document.
// So this is a good place to plug in a panic handling middleware, logging and metrics
func setupGlobalMiddleware(handler http.Handler) http.Handler {
	return handler
}
