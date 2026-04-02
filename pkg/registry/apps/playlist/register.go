package playlist

import (
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	playlistapp "github.com/grafana/grafana/apps/playlist/pkg/app"
	roleauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
}

func RegisterAppInstaller(
	features featuremgmt.FeatureToggles,
) (*AppInstaller, error) {
	installer := &AppInstaller{}
	specificConfig := any(&playlistapp.PlaylistConfig{
		//nolint:staticcheck // not yet migrated to OpenFeature
		EnableReconcilers: features.IsEnabledGlobally(featuremgmt.FlagPlaylistsReconciler),
	})
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), specificConfig, playlistapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

func (p *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	//nolint:staticcheck // not yet migrated to Resource Authorizer
	return roleauthorizer.NewRoleAuthorizer()
}
