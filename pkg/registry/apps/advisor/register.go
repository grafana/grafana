package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/builder/runner"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

type AdvisorAppProvider struct {
	app.Provider
}

func RegisterApp(
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
	orgService org.Service,
) *AdvisorAppProvider {
	provider := &AdvisorAppProvider{}
	pluginConfig := cfg.PluginSettings["grafana-advisor-app"]
	specificConfig := checkregistry.AdvisorAppConfig{
		CheckRegistry: checkRegistry,
		PluginConfig:  pluginConfig,
		StackID:       cfg.StackID,
		OrgService:    orgService,
	}
	appCfg := &runner.AppBuilderConfig{
		OpenAPIDefGetter:         advisorv0alpha1.GetOpenAPIDefinitions,
		ManagedKinds:             advisorapp.GetKinds(),
		Authorizer:               advisorapp.GetAuthorizer(),
		CustomConfig:             any(specificConfig),
		AllowedV0Alpha1Resources: []string{builder.AllResourcesAllowed},
	}
	provider.Provider = simple.NewAppProvider(apis.LocalManifest(), appCfg, advisorapp.New)
	return provider
}

var (
	_ appsdkapiserver.AppInstaller    = (*AdvisorAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AdvisorAppInstaller)(nil)
)

type AdvisorAppInstaller struct {
	appsdkapiserver.AppInstaller
}

func ProvideAppInstaller() (*AdvisorAppInstaller, error) {
	installer := &AdvisorAppInstaller{}
	i, err := advisorapp.ProvideAppInstaller(nil)
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

// GetAuthorizer returns the authorizer for the plugins app.
func (a *AdvisorAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return advisorapp.GetAuthorizer()
}
