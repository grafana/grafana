package prefimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXORMPreferencesDataAccess(t *testing.T) {
	testIntegrationPreferencesDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlStore{db: ss}
	})
}
