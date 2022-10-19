package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXORMGetDashboardVersion(t *testing.T) {
	testIntegrationGetDashboardVersion(t, func(ss db.DB) store {
		return &sqlStore{
			db:      ss,
			dialect: ss.GetDialect(),
		}
	})
}
