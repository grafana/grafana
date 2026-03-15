package stalebot

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/stalebot/pkg/apis/manifestdata"
	stalebotapp "github.com/grafana/grafana/apps/stalebot/pkg/app"
	roleauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/setting"
)

var _ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

func (s *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	//nolint:staticcheck // not yet migrated to Resource Authorizer
	return roleauthorizer.NewRoleAuthorizer()
}

func RegisterAppInstaller(cfg *setting.Cfg) (*AppInstaller, error) {
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), nil, stalebotapp.New)
	appConfig := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *manifestdata.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	return &AppInstaller{AppInstaller: i}, nil
}
