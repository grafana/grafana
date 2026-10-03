package policy

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/policy/pkg/apis/manifestdata"
	policyapp "github.com/grafana/grafana/apps/policy/pkg/app"
)

var _ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

// RegisterAppInstaller installs the policy app. Its API is not served unless enabled with
// [grafana-apiserver] runtime_config = policy.grafana.app/v0alpha1=true.
func RegisterAppInstaller() (*AppInstaller, error) {
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), nil, policyapp.New)
	appCfg := app.Config{
		KubeConfig:   restclient.Config{}, // overridden by the installer's InitializeApp method
		ManifestData: *manifestdata.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appCfg, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	return &AppInstaller{AppInstaller: i}, nil
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return policyapp.GetAuthorizer()
}
