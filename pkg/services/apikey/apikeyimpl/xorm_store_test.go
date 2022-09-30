package apikeyimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXORMApiKeyDataAccess(t *testing.T) {
	testIntegrationApiKeyDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlStore{db: ss, cfg: ss.Cfg}
	})
}
