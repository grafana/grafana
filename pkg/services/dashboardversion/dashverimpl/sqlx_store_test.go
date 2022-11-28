package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationSQLxGetDashboardVersion(t *testing.T) {
	testIntegrationGetDashboardVersion(t, func(ss *sqlstore.SQLStore) store {
		return &sqlxStore{
			sess: ss.GetSqlxSession(),
		}
	})
}
