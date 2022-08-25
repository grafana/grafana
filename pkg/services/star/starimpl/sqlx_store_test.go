package starimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxUserStarsDataAccess(t *testing.T) {
	testIntegrationUserStarsDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{sess: ss.GetSqlxSession()}
	})
}
