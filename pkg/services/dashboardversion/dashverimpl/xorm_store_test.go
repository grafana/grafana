package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXORMGetDashboardVersion(t *testing.T) {
	testIntegrationGetDashboardVersion(t, func(ss *sqlstore.SQLStore) store {
		return &sqlStore{
			db:      ss,
			dialect: ss.GetDialect(),
		}
	})
}
