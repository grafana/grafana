package live

import (
	"context"
	"net/http"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	livev1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
	apis "github.com/grafana/grafana/apps/live/pkg/apis/manifestdata"
	liveapp "github.com/grafana/grafana/apps/live/pkg/app"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/apiserver/rawroutes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanalive "github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller = (*AppInstaller)(nil)
	_ rawroutes.Provider           = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg  *setting.Cfg
	live *grafanalive.GrafanaLive
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	live *grafanalive.GrafanaLive,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		cfg:  cfg,
		live: live,
	}

	provider := simple.NewAppProvider(apis.LocalManifest(), nil, liveapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *apis.LocalManifest().ManifestData,
		SpecificConfig: &liveapp.LiveConfig{
			Enable: true,
			//	TagHandler: tagHandler,
		},
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

// RawRoutes serves the Live websocket at
// /apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws from the local Live node.
func (a *AppInstaller) RawRoutes() []rawroutes.Route {
	if a.live == nil {
		return nil
	}
	return []rawroutes.Route{{
		Group:   livev1.APIGroup,
		Version: livev1.APIVersion,
		Method:  http.MethodGet,
		Path:    liveapp.WebsocketPath,
		Handler: liveapp.NewWebsocketHandler(a.live),
	}}
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Any authenticated user can access the API
		return authorizer.DecisionAllow, "", nil
	})
}
