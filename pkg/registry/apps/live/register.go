package live

import (
	"context"
	"net/http"
	"strings"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
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
	channels  ChannelLister
}

// RegisterAppInstaller installs live.grafana.app in single-tenant Grafana,
// served by its local Live node.
func RegisterAppInstaller(
	_ *setting.Cfg,
	_ featuremgmt.FeatureToggles,
	live *grafanalive.GrafanaLive,
) (*AppInstaller, error) {
	return NewAppInstaller(live, live)
}

// NewAppInstaller returns the live.grafana.app installer for a host that
// supplies the websocket and the channel list, such as single-tenant Grafana or
// a multi-tenant Live server. Nothing is stored.
func NewAppInstaller(websocket liveapp.WebsocketProvider, channels ChannelLister) (*AppInstaller, error) {
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
	return &AppInstaller{AppInstaller: i, websocket: websocket, channels: channels}, nil
}

// InstallAPIs installs the group with the generated Channel store replaced by
// a read-only view of the Live node, so the group stores nothing.
func (a *AppInstaller) InstallAPIs(server appsdkapiserver.GenericAPIServer, opts generic.RESTOptionsGetter) error {
	if a.channels == nil {
		return a.AppInstaller.InstallAPIs(server, opts)
	}
	return a.AppInstaller.InstallAPIs(&channelStorageServer{
		GenericAPIServer: server,
		storage:          newChannelStorage(a.channels),
	}, opts)
}

// channelStorageServer swaps in the Channel storage before the group is
// installed, so the host's storage setup never sees the generated store. The
// generated subresource stores, such as channels/status, wrap that store, so
// they are removed: status is returned with the channel itself.
type channelStorageServer struct {
	appsdkapiserver.GenericAPIServer
	storage rest.Storage
}

func (s *channelStorageServer) InstallAPIGroup(info *genericapiserver.APIGroupInfo) error {
	resource := livev1.ChannelKind().Plural()
	for _, storageMap := range info.VersionedResourcesStorageMap {
		if _, ok := storageMap[resource]; !ok {
			continue
		}
		for path := range storageMap {
			if strings.HasPrefix(path, resource+"/") {
				delete(storageMap, path)
			}
		}
		storageMap[resource] = s.storage
	}
	return s.GenericAPIServer.InstallAPIGroup(info)
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
