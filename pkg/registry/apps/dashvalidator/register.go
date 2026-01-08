package dashvalidator

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	validatorapis "github.com/grafana/grafana/apps/dashvalidator/pkg/apis/manifestdata"
	validatorapp "github.com/grafana/grafana/apps/dashvalidator/pkg/app"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	roleauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

var _ appsdkapiserver.AppInstaller = (*DashValidatorAppInstaller)(nil)

type DashValidatorAppInstaller struct {
	appsdkapiserver.AppInstaller
}

// RegisterAppInstaller is called by Wire to create the app installer
func RegisterAppInstaller(
	datasourceSvc datasources.DataSourceService,
	pluginCtx *plugincontext.Provider,
	httpClientProvider httpclient.Provider,
) (*DashValidatorAppInstaller, error) {
	// Create specific config for the app
	specificConfig := &validatorapp.DashValidatorConfig{
		DatasourceSvc:      datasourceSvc,
		PluginCtx:          pluginCtx,
		HTTPClientProvider: httpClientProvider,
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
