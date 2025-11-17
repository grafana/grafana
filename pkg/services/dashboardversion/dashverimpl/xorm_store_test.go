package dashverimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationXORMGetDashboardVersion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testIntegrationGetDashboardVersion(t, func(ss db.DB) store {
		return &sqlStore{
			db:      ss,
			dialect: ss.GetDialect(),
		}
	})
}
