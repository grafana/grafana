package db

import "github.com/grafana/grafana/pkg/services/sqlstore"

type ReplDB interface {
	// DB is the primary database connection.
	DB() *sqlstore.SQLStore
	ReadReplica() *sqlstore.SQLStore
}
