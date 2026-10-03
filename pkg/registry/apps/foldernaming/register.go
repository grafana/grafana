package foldernaming

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/foldernaming/pkg/apis/manifestdata"
	foldernamingapp "github.com/grafana/grafana/apps/foldernaming/pkg/app"
)

var _ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

// RegisterAppInstaller installs the folder naming app. Its API is not served unless enabled,
// together with the policy API it writes to, with
// [grafana-apiserver] runtime_config = policy.grafana.app/v0alpha1=true,foldernaming.grafana.app/v0alpha1=true
func RegisterAppInstaller() (*AppInstaller, error) {
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), nil, foldernamingapp.New)
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
	return foldernamingapp.GetAuthorizer()
}
