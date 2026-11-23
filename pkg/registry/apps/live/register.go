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
	websocket liveapp.WebsocketProvider
}

// RegisterAppInstaller installs live.grafana.app in single-tenant Grafana,
// served by its local Live node.
func RegisterAppInstaller(
	_ *setting.Cfg,
	_ featuremgmt.FeatureToggles,
	live *grafanalive.GrafanaLive,
) (*AppInstaller, error) {
	return NewAppInstaller(live)
}

// NewAppInstaller returns the live.grafana.app installer for a host that
// supplies the websocket, such as single-tenant Grafana or a multi-tenant Live
// server. Nothing is stored.
func NewAppInstaller(websocket liveapp.WebsocketProvider) (*AppInstaller, error) {
	provider := simple.NewAppProvider(apis.LocalManifest(), nil, liveapp.New)
	appConfig := app.Config{
		KubeConfig:     restclient.Config{},
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: &liveapp.LiveConfig{Enable: true},
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	return &AppInstaller{AppInstaller: i, websocket: websocket}, nil
}

// RawRoutes serves the Live websocket at
// /apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws from the host's provider.
func (a *AppInstaller) RawRoutes() []rawroutes.Route {
	if a.websocket == nil {
		return nil
	}
	return []rawroutes.Route{{
		API:        livev1.GroupVersion,
		Namespaced: true,
		Method:     http.MethodGet,
		Path:       liveapp.WebsocketPath,
		Handler:    liveapp.NewWebsocketHandler(a.websocket),
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
