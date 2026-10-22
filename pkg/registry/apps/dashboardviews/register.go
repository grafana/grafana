package dashboardviews

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/dashboardviews/pkg/apis/manifestdata"
	dashboardviewsapp "github.com/grafana/grafana/apps/dashboardviews/pkg/app"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller                          = (*AppInstaller)(nil)
	_ appinstaller.NamespaceScopedStorageAuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	ac           accesscontrol.AccessControl
	dashboardSvc dashboards.DashboardService
}

// GetAuthorizer gates the API on FlagGrafanaSavedDashboardViews, evaluated per request so it
// can differ per tenant. Dashboard-scoped authorization happens per object in the storage
// authorizer (storage_authorizer.go).
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}
		if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaSavedDashboardViews, false, openfeature.TransactionContext(ctx)) {
			return authorizer.DecisionDeny, "saved dashboard views feature is not enabled", nil
		}
		return authorizer.DecisionAllow, "", nil
	})
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	ac accesscontrol.AccessControl,
	dashboardSvc dashboards.DashboardService,
) (*AppInstaller, error) {
	installer := &AppInstaller{ac: ac, dashboardSvc: dashboardSvc}
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
