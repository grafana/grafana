package network

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/network/pkg/apis/manifestdata"
	networkapp "github.com/grafana/grafana/apps/network/pkg/app"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var _ appsdkapiserver.AppInstaller = (*NetworkAppInstaller)(nil)

type NetworkAppInstaller struct {
	appsdkapiserver.AppInstaller
	namespacer request.NamespaceMapper
}

func RegisterAppInstaller(cfg *setting.Cfg) (*NetworkAppInstaller, error) {
	installer := &NetworkAppInstaller{
		namespacer: request.GetNamespaceMapper(cfg),
	}
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), nil, networkapp.New)

	appCfg := app.Config{
		KubeConfig:   restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData: *manifestdata.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appCfg, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (a *NetworkAppInstaller) GetAuthorizer() authorizer.Authorizer {
	return networkapp.GetAuthorizer()
}
