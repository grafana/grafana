package server

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/web"
)

func ProvideTestEnv(
	server *Server,
	db db.DB,
	cfg *setting.Cfg,
	ns *notifications.NotificationServiceMock,
	grpcServer grpcserver.Provider,
	pluginRegistry registry.Service,
	httpClientProvider httpclient.Provider,
	oAuthTokenService *oauthtokentest.Service,
	featureMgmt featuremgmt.FeatureToggles,
	resourceClient resource.ResourceClient,
	idService auth.IDService,
) (*TestEnv, error) {
	return &TestEnv{
		Server:              server,
		SQLStore:            db,
		Cfg:                 cfg,
		NotificationService: ns,
		GRPCServer:          grpcServer,
		PluginRegistry:      pluginRegistry,
		HTTPClientProvider:  httpClientProvider,
		OAuthTokenService:   oAuthTokenService,
		FeatureToggles:      featureMgmt,
		ResourceClient:      resourceClient,
		IDService:           idService,
	}, nil
}

type TestEnv struct {
	Server              *Server
	SQLStore            db.DB
	Cfg                 *setting.Cfg
	NotificationService *notifications.NotificationServiceMock
	GRPCServer          grpcserver.Provider
	PluginRegistry      registry.Service
	HTTPClientProvider  httpclient.Provider
	OAuthTokenService   *oauthtokentest.Service
	RequestMiddleware   web.Middleware
	FeatureToggles      featuremgmt.FeatureToggles
	ResourceClient      resource.ResourceClient
	IDService           auth.IDService
}
