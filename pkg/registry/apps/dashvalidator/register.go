package dashvalidator

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	validatorapis "github.com/grafana/grafana/apps/dashvalidator/pkg/apis/manifestdata"
	validatorapp "github.com/grafana/grafana/apps/dashvalidator/pkg/app"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator/prometheus"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var _ appsdkapiserver.AppInstaller = (*DashValidatorAppInstaller)(nil)

type DashValidatorAppInstaller struct {
	appsdkapiserver.AppInstaller
	ac accesscontrol.AccessControl
}

// RegisterAppInstaller is called by Wire to create the app installer.
// This is the composition root where all components are created and wired together.
func RegisterAppInstaller(
	datasourceSvc datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	ac accesscontrol.AccessControl,
) (*DashValidatorAppInstaller, error) {
	// Create MetricsCache - shared cache for all datasource types
	metricsCache := cache.NewMetricsCache()

	// Create and register Prometheus provider
	prometheusProvider := prometheus.NewPrometheusProvider(cache.DefaultMetricsCacheTTL)
	metricsCache.RegisterProvider(datasources.DS_PROMETHEUS, prometheusProvider)

	// Create validators map - keyed by datasource type
	validators := map[string]validator.DatasourceValidator{
		datasources.DS_PROMETHEUS: prometheus.NewValidator(metricsCache),
	}

	// Create specific config for the app with all components
	specificConfig := &validatorapp.DashValidatorConfig{
		DatasourceSvc:      datasourceSvc,
		HTTPClientProvider: httpClientProvider,
		MetricsCache:       metricsCache,
		Validators:         validators,
		AC:                 ac,
	}

	// Create the app provider
	provider := simple.NewAppProvider(
		validatorapis.LocalManifest(),
		specificConfig,
		validatorapp.New,
	)

	// Create app config
	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // Will be overridden by installer
		ManifestData:   *validatorapis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}

	// Create the default installer
	defaultInstaller, err := appsdkapiserver.NewDefaultAppInstaller(
		provider,
		appConfig,
		validatorapis.NewGoTypeAssociator(),
	)
	if err != nil {
		return nil, err
	}

	return &DashValidatorAppInstaller{
		AppInstaller: defaultInstaller,
		ac:           ac,
	}, nil
}

// GetAuthorizer provides fine-grained authorization for the app.
// Uses AccessControl to evaluate permissions (datasources:read, datasources:query, + dashboards:create)
func (a *DashValidatorAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "authentication required", err
			}

			// For now we only support /check, which is a POST and we don't support any other verbs
			if attr.GetVerb() != "create" {
				return authorizer.DecisionDeny, "operation not supported", nil
			}

			// POST /check maps to "create" verb.
			// No scope is defined because we don't know which datasources the user needs
			// before the validation request is processed. This checks that the user has
			// access to at least one datasource. Per-datasource scoped checks are applied
			// when we resolve datasource UIDs in the handler.
			evaluator := accesscontrol.EvalAll(
				accesscontrol.EvalPermission(datasources.ActionRead),
				accesscontrol.EvalPermission(datasources.ActionQuery),
				accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate),
			)
			ok, err := a.ac.Evaluate(ctx, user, evaluator)
			if err != nil {
				return authorizer.DecisionDeny, "permission check failed", err
			}
			if ok {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "insufficient permissions: datasources:read, datasources:query, and dashboards:create required", nil
		},
	)
}
