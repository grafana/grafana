package prefimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxPreferencesDataAccess(t *testing.T) {
	testIntegrationPreferencesDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{sess: ss.GetSqlxSession()}
	})
}
