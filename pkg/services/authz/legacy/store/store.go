package store

import "github.com/grafana/grafana/pkg/storage/legacysql"

type Store struct {
	sql legacysql.LegacyDatabaseProvider
}

func NewStore(sql legacysql.LegacyDatabaseProvider) *Store {
	return &Store{
		sql: sql,
	}
}
