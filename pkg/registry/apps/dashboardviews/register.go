package dashboardviews

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/dashboardviews/pkg/apis/manifestdata"
	dashboardviewsapp "github.com/grafana/grafana/apps/dashboardviews/pkg/app"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller                          = (*AppInstaller)(nil)
	_ appinstaller.NamespaceScopedStorageAuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	ac accesscontrol.AccessControl
}

// GetAuthorizer allows every resource request through. Real, dashboard-scoped authorization
// (dashboards:read on spec.dashboardUID, folder-inheritance-safe) lands in the next PR, applied
// per-object in the REST layer rather than here — see saved-views/02-authz.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}
		return authorizer.DecisionAllow, "", nil
	})
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	ac accesscontrol.AccessControl,
) (*AppInstaller, error) {
	installer := &AppInstaller{ac: ac}
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), nil, dashboardviewsapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // overridden by the installer's InitializeApp method
		ManifestData: *manifestdata.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, manifestdata.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}
