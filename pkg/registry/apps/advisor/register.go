package advisor

import (
	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	advisorapi "github.com/grafana/grafana/apps/advisor/pkg/apis"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/client-go/rest"
)

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

func ProvideAppInstaller(
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
	orgService org.Service,
) (*AdvisorAppInstaller, error) {
	provider := simple.NewAppProvider(advisorapi.LocalManifest(), nil, advisorapp.New)
	pluginConfig := cfg.PluginSettings["grafana-advisor-app"]
	specificConfig := checkregistry.AdvisorAppConfig{
		CheckRegistry: checkRegistry,
		PluginConfig:  pluginConfig,
		StackID:       cfg.StackID,
		OrgService:    orgService,
	}
	appCfg := app.Config{
		KubeConfig:     rest.Config{},
		ManifestData:   *advisorapi.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	installer := &AdvisorAppInstaller{}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appCfg, advisorapi.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}
