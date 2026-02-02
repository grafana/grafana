package dashvalidator

import (
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
	"github.com/grafana/grafana/pkg/infra/httpclient"
	roleauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var _ appsdkapiserver.AppInstaller = (*DashValidatorAppInstaller)(nil)

type DashValidatorAppInstaller struct {
	appsdkapiserver.AppInstaller
}

// RegisterAppInstaller is called by Wire to create the app installer.
// This is the composition root where all components are created and wired together.
func RegisterAppInstaller(
	datasourceSvc datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
) (*DashValidatorAppInstaller, error) {
	// Create MetricsCache - shared cache for all datasource types
	metricsCache := cache.NewMetricsCache()

	// Create and register Prometheus provider
	prometheusProvider := prometheus.NewPrometheusProvider(cache.DefaultMetricsCacheTTL)
	metricsCache.RegisterProvider("prometheus", prometheusProvider)

	// Create validators map - keyed by datasource type
	validators := map[string]validator.DatasourceValidator{
		"prometheus": prometheus.NewValidator(metricsCache),
	}

	// Create specific config for the app with all components
	specificConfig := &validatorapp.DashValidatorConfig{
		DatasourceSvc:      datasourceSvc,
		HTTPClientProvider: httpClientProvider,
		MetricsCache:       metricsCache,
		Validators:         validators,
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
	}, nil
}

// GetAuthorizer provides the authorization for the app
func (a *DashValidatorAppInstaller) GetAuthorizer() authorizer.Authorizer {
	//nolint:staticcheck
	return roleauthorizer.NewRoleAuthorizer()
}
