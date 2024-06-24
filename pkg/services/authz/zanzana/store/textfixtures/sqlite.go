package textfixtures

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/store/migration"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func SQLiteIntegrationTest(tb testing.TB) *sql.DB {
	if testing.Short() || !db.IsTestDbSQLite() {
		tb.Skip("skipping integration test")
	}

	db, cfg := db.InitTestDBWithCfg(tb)

	m := migrator.NewMigrator(db.GetEngine(), cfg)
	err := migration.RunWithMigrator(m, cfg, store.EmbedMigrations, store.SQLiteMigrationDir)
	require.NoError(tb, err)

	return db.GetEngine().DB().DB
}
