package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationSQLxGetDashboardVersion(t *testing.T) {
	testIntegrationGetDashboardVersion(t, func(ss db.DB) store {
		return &sqlxStore{
			sess: ss.GetSqlxSession(),
		}
	})
}
