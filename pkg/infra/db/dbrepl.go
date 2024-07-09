package db

import (
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ReplDB interface {
	// DB is the primary database connection.
	DB() *sqlstore.SQLStore

	// ReadReplica is the read-only database connection. If no read replica is configured, the implementation must return the primary DB.
	// TODO: ReadReplica will take a list of replicas and load-balance accross them in a future milestone.
	ReadReplica() *sqlstore.SQLStore
}

type testReplDB struct {
	db          *sqlstore.SQLStore
	readReplica *sqlstore.SQLStore
}

func (r testReplDB) DB() *sqlstore.SQLStore {
	return r.db
}

func (r testReplDB) ReadReplica() *sqlstore.SQLStore {
	if r.readReplica == nil {
		return r.db
	}
	return r.readReplica
}

// WrapReplDB wraps the provided database connection in a ReplDB, leaving the
// replica connection nil. The interface will always return the primary
// database. This should be removed when the ReplDB interface is fully
// implemented; it is a temporary measure.
func WrapReplDB(db *sqlstore.SQLStore) testReplDB {
	return testReplDB{
		db:          db,
		readReplica: nil,
	}
}
