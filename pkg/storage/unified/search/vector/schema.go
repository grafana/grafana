package vector

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// MigrateVectorStore runs migrations for the vector database. This uses the
// same migrator pattern as MigrateResourceStore but against the separate
// pgvector database. All migrations are PostgreSQL-only.
//
// The migrator only creates the pgvector extension and the vector_collections
// catalog table. Per-collection vec_<id> tables (which hold the embeddings
// themselves) are created lazily at runtime by the VectorBackend.
func MigrateVectorStore(ctx context.Context, engine *xorm.Engine, cfg *setting.Cfg) error {
	mg := migrator.NewScopedMigrator(engine, cfg, "vector")
	mg.AddCreateMigration()

	initVectorTables(mg)

	sec := cfg.Raw.Section("database_vector")
	return mg.RunMigrations(
		ctx,
		sec.Key("migration_locking").MustBool(true),
		sec.Key("locking_attempt_timeout_sec").MustInt(),
	)
}

func initVectorTables(mg *migrator.Migrator) {
	mg.AddMigration("create pgvector extension",
		migrator.NewRawSQLMigration("").Postgres(`CREATE EXTENSION IF NOT EXISTS vector;`))

	vectorCollections := migrator.Table{
		Name: "vector_collections",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigSerial, IsPrimaryKey: true, IsAutoIncrement: true, Nullable: false},
			{Name: "namespace", Type: migrator.DB_Varchar, Length: 256, Nullable: false},
			{Name: "model", Type: migrator.DB_Varchar, Length: 256, Nullable: false},
			{Name: "collection_id", Type: migrator.DB_Varchar, Length: 512, Nullable: false},
			{Name: "created_at", Type: migrator.DB_TimeStampz, Nullable: false, Default: "CURRENT_TIMESTAMP"},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "model", "collection_id"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create vector_collections table",
		migrator.NewAddTableMigration(vectorCollections))
	mg.AddMigration("add unique index on vector_collections (namespace, model, collection_id)",
		migrator.NewAddIndexMigration(vectorCollections, vectorCollections.Indices[0]))

	// Global checkpoint table: a single row holding the maximum resource_version
	// seen across every collection. The write pipeline uses this as its resume
	// point. A single row keeps reads O(1) and writes a single bumped UPSERT per
	// Upsert batch. This concept is unified-storage specific and will likely go
	// away once vectors for non-unified-storage resources are supported.
	vectorLatestRV := migrator.Table{
		Name: "vector_latest_rv",
		Columns: []*migrator.Column{
			// `id` is always 1. The CHECK constraint in the tail migration
			// enforces at-most-one-row.
			{Name: "id", Type: migrator.DB_Int, IsPrimaryKey: true, Nullable: false},
			{Name: "latest_rv", Type: migrator.DB_BigInt, Nullable: false, Default: "0"},
		},
	}
	mg.AddMigration("create vector_latest_rv table",
		migrator.NewAddTableMigration(vectorLatestRV))
	// Enforce single-row shape and seed the row with rv=0. Raw SQL because the
	// migrator has no structured API for CHECK constraints or seed inserts.
	mg.AddMigration("enforce single-row and seed vector_latest_rv",
		migrator.NewRawSQLMigration("").Postgres(`
			ALTER TABLE vector_latest_rv ADD CONSTRAINT vector_latest_rv_single CHECK (id = 1);
			INSERT INTO vector_latest_rv (id, latest_rv) VALUES (1, 0) ON CONFLICT DO NOTHING;
		`))
}
