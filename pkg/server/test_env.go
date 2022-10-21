package server

import (
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func ProvideTestEnv(server *Server, store *sqlstore.SQLStore, orgService org.Service, userService user.Service, ns *notifications.NotificationServiceMock, grpcServer grpcserver.Provider) *TestEnv {
	return &TestEnv{server, store, ns, grpcServer, orgService, userService}
}

type TestEnv struct {
	Server              *Server
	SQLStore            *sqlstore.SQLStore
	NotificationService *notifications.NotificationServiceMock
	GRPCServer          grpcserver.Provider

	OrgService  org.Service
	UserService user.Service
}
