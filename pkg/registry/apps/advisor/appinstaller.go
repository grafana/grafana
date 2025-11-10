package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	advisorapi "github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/client-go/rest"
)

type noopCheckRegistry struct{}

func (m *noopCheckRegistry) Checks() []checks.Check {
	return []checks.Check{}
}

var (
	_ appsdkapiserver.AppInstaller    = (*AdvisorAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AdvisorAppInstaller)(nil)
)

type AdvisorAppInstaller struct {
	appsdkapiserver.AppInstaller
}

// GetAuthorizer returns the authorizer for the plugins app.
func (a *AdvisorAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return advisorapp.GetAuthorizer()
}

func ProvideAppInstaller() (*AdvisorAppInstaller, error) {
	provider := simple.NewAppProvider(advisorapi.LocalManifest(), nil, advisorapp.New)
	specificConfig := checkregistry.AdvisorAppConfig{
		CheckRegistry: &noopCheckRegistry{},
		PluginConfig:  map[string]string{},
		StackID:       "",  // Numeric stack ID for standalone mode
		OrgService:    nil, // Not needed when StackID is set
	}

	appConfig := app.Config{
		KubeConfig:     rest.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *advisorapi.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}

	installer := &AdvisorAppInstaller{}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, advisorapi.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
