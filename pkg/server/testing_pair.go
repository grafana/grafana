package server

import "github.com/grafana/grafana/pkg/services/sqlstore"

type TestingPair struct {
	Server   *Server
	SQLStore *sqlstore.SQLStore
}

func ProvideTestingPair(Server *Server, SQLStore *sqlstore.SQLStore) *TestingPair {
	return &TestingPair{
		Server:   Server,
		SQLStore: SQLStore,
	}
}
