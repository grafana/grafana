package service

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXormDataAccess(t *testing.T) {
	testIntegrationDataAccess(t, func(ss *sqlstore.SQLStore) Store {
		return &SqlStore{db: ss, logger: log.New("sqlx_datasource_store")}
	})
}
