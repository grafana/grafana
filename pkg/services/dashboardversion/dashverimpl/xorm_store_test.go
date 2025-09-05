package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests"
)

func TestIntegrationXORMGetDashboardVersion(t *testing.T) {
	tests.SkipIntegrationTestInShortMode(t)

	testIntegrationGetDashboardVersion(t, func(ss db.DB) store {
		return &sqlStore{
			db:      ss,
			dialect: ss.GetDialect(),
		}
	})
}
