package apikeyimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxApiKeyDataAccess(t *testing.T) {
	testIntegrationApiKeyDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{sess: ss.GetSqlxSession(), cfg: ss.Cfg}
	})
}
