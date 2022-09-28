package tempuserimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxTempUserCommandsAndQueries(t *testing.T) {
	testIntegrationTempUserCommandsAndQueries(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{sess: ss.GetSqlxSession()}
	})
}
