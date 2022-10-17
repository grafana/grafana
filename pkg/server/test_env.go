package server

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/notifications"
)

func ProvideTestEnv(server *Server, store db.DB, ns *notifications.NotificationServiceMock, grpcServer grpcserver.Provider) (*TestEnv, error) {
	return &TestEnv{server, store, ns, grpcServer}, nil
}

type TestEnv struct {
	Server              *Server
	SQLStore            db.DB
	NotificationService *notifications.NotificationServiceMock
	GRPCServer          grpcserver.Provider
}
