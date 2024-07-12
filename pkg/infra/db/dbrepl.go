package db

import (
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ReplDB interface {
	// DB is the primary database connection.
	DB() *sqlstore.SQLStore

	// ReadReplica is the read-only database connection. If no read replica is configured, the implementation must return the primary DB.
	// TODO: ReadReplica will take a list of replicas and load-balance across them in a future milestone.
	ReadReplica() *sqlstore.SQLStore
}
