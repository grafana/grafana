package service

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxDataAccess(t *testing.T) {
	testIntegrationDataAccess(t, func(ss *sqlstore.SQLStore) Store {
		return &SqlxStore{sess: ss.GetSqlxSession(), dialect: ss.GetDialect(), logger: log.New("sqlx_datasource_store")}
	})
}
