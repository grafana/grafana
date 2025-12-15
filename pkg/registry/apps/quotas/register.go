package quotas

import (
	"github.com/grafana/grafana/apps/quotas/pkg/apis"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	quotasapp "github.com/grafana/grafana/apps/quotas/pkg/app"
	roleauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*QuotasAppInstaller)(nil)
)

type QuotasAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
}

func (a *QuotasAppInstaller) GetAuthorizer() authorizer.Authorizer {
	//nolint:staticcheck // not yet migrated to Resource Authorizer
	return roleauthorizer.NewRoleAuthorizer()
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	resourceClient resource.ResourceClient,
) (*QuotasAppInstaller, error) {
	installer := &QuotasAppInstaller{
		cfg: cfg,
	}
	specificConfig := &quotasapp.QuotasAppConfig{
		ResourceClient: resourceClient,
	}
	provider := simple.NewAppProvider(apis.LocalManifest(), specificConfig, quotasapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}
