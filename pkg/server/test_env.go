package server

import (
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideTestEnv(server *Server, store *sqlstore.SQLStore, ns *notifications.NotificationServiceMock) (*TestEnv, error) {
	return &TestEnv{server, store, ns}, nil
}

type TestEnv struct {
	Server              *Server
	SQLStore            *sqlstore.SQLStore
	NotificationService *notifications.NotificationServiceMock
}
