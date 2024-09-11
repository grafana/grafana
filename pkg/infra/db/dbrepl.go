package db

import (
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ReplDB interface {
	// DB is the primary database connection.
	DB() *sqlstore.SQLStore

	// ReadReplica is the read-only database connection. If no read replica is configured, the implementation must return the primary DB.
	ReadReplica() *sqlstore.SQLStore
}

// FakeREplDBFromDBForTests returns a ReplDB that uses the given DB as the primary connection. It's a helper function for tests.
func FakeReplDBFromDB(primary DB) ReplDB {
	ss := primary.(*sqlstore.SQLStore)
	return sqlstore.FakeReplStoreFromStore(ss)
}
