package server

import "github.com/grafana/grafana/pkg/services/sqlstore"

func ProvideTestEnv(server *Server, store *sqlstore.SQLStore) (*TestEnv, error) {
	return &TestEnv{server, store}, nil
}

type TestEnv struct {
	Server   *Server
	SQLStore *sqlstore.SQLStore
}
