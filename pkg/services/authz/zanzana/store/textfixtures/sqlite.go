package textfixtures

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func SQLiteIntegrationTest(tb testing.TB) *sql.DB {
	if testing.Short() || !db.IsTestDbSQLite() {
		tb.Skip("skipping integration test")
	}

	sql, cfg := db.InitTestDBWithCfg(tb)
	// We create a new embedded store so all migrations are triggered
	_, err := zanzana.NewEmbeddedStore(cfg, sql, log.NewNopLogger())
	require.NoError(tb, err)
	return sql.GetEngine().DB().DB
}
