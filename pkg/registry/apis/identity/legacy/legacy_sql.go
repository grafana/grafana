package legacy

import (
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ LegacyIdentityStore = (*legacySQLStore)(nil)
)

func NewLegacySQLStores(sql legacysql.LegacyDatabaseProvider) LegacyIdentityStore {
	return &legacySQLStore{
		sql: sql,
	}
}

type legacySQLStore struct {
	sql legacysql.LegacyDatabaseProvider
}
