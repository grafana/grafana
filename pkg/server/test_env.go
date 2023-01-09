package server

import (
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideTestEnv(
	server *Server,
	store *sqlstore.SQLStore,
	ns *notifications.NotificationServiceMock,
	grpcServer grpcserver.Provider,
	pluginRegistry registry.Service,
	httpClientProvider httpclient.Provider,
	oAuthTokenService *oauthtokentest.Service,
) (*TestEnv, error) {
	return &TestEnv{
		server,
		store,
		ns,
		grpcServer,
		pluginRegistry,
		httpClientProvider,
		oAuthTokenService,
	}, nil
}

type TestEnv struct {
	Server              *Server
	SQLStore            *sqlstore.SQLStore
	NotificationService *notifications.NotificationServiceMock
	GRPCServer          grpcserver.Provider
	PluginRegistry      registry.Service
	HTTPClientProvider  httpclient.Provider
	OAuthTokenService   *oauthtokentest.Service
}
