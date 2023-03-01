package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXORMGetDashboardVersion(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationGetDashboardVersion(t, func(ss db.DB) store {
		return &sqlStore{
			db:      ss,
			dialect: ss.GetDialect(),
		}
	})
}
