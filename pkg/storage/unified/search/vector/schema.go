package vector

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// MigrateVectorStore runs migrations for the vector database.
//
// The core table is `dashboard_embeddings`, `PARTITION BY LIST (namespace)`.
// Every tenant starts in `dashboard_embeddings_default` (no HNSW — searches
// seq-scan a namespace-filtered subset, which is sub-ms while the tenant is
// small). Tenants that cross `cfg.VectorPromotionThreshold` rows get promoted
// by the sweeper: a dedicated partition with its own HNSW index. Postgres's
// partition pruning picks the right partition per query — plan time is flat
// regardless of how many tenants are promoted, unlike the partial-index
// approach this replaced.
//
// Structured migrator + raw SQL mix: raw SQL is unavoidable where the xorm
// migrator can't express the DDL (halfvec column type, PARTITION BY LIST,
// single-row CHECK + seed).
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

	// Partitioned parent. DEFAULT partition catches every tenant until they're
	// promoted. Columns chosen to be storage-neutral — `namespace` and `model`
	// are opaque strings; `collectionID` is not stored (the table's identity
	// implies the resource type).
	mg.AddMigration("create dashboard_embeddings partitioned table",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE TABLE IF NOT EXISTS dashboard_embeddings (
				id BIGSERIAL,
				namespace VARCHAR(256) NOT NULL,
				model VARCHAR(256) NOT NULL,
				name VARCHAR(256) NOT NULL,
				subresource VARCHAR(256) NOT NULL DEFAULT '',
				folder VARCHAR(256),
				content TEXT NOT NULL,
				metadata JSONB,
				embedding halfvec(1024) NOT NULL,
				PRIMARY KEY (namespace, model, name, subresource)
			) PARTITION BY LIST (namespace);
		`))

	// DEFAULT partition holds all un-promoted tenants.
	mg.AddMigration("create dashboard_embeddings default partition",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE TABLE IF NOT EXISTS dashboard_embeddings_default
				PARTITION OF dashboard_embeddings DEFAULT;
		`))

	// btree on namespace narrows seq scans for tenants in DEFAULT. No HNSW on
	// DEFAULT — small tenants don't need one; promoted tenants get a per-
	// partition HNSW attached at promotion time.
	mg.AddMigration("create namespace btree on dashboard_embeddings_default",
		migrator.NewRawSQLMigration("").Postgres(
			`CREATE INDEX IF NOT EXISTS dashboard_embeddings_default_namespace_idx
				ON dashboard_embeddings_default (namespace);`,
		))

	mg.AddMigration("create metadata GIN on dashboard_embeddings_default",
		migrator.NewRawSQLMigration("").Postgres(
			`CREATE INDEX IF NOT EXISTS dashboard_embeddings_default_metadata_idx
				ON dashboard_embeddings_default USING GIN (metadata);`,
		))

	// vector_promoted: observability log of which (namespace, resource)
	// tuples have a dedicated partition. pg_inherits is the authority on
	// whether the partition actually exists; this just records when the
	// sweeper acted.
	vectorPromoted := migrator.Table{
		Name: "vector_promoted",
		Columns: []*migrator.Column{
			{Name: "namespace", Type: migrator.DB_Varchar, Length: 256, Nullable: false, IsPrimaryKey: true},
			{Name: "resource", Type: migrator.DB_Varchar, Length: 256, Nullable: false, IsPrimaryKey: true},
			{Name: "promoted_at", Type: migrator.DB_TimeStampz, Nullable: false, Default: "CURRENT_TIMESTAMP"},
		},
	}
	mg.AddMigration("create vector_promoted table",
		migrator.NewAddTableMigration(vectorPromoted))

	// vector_latest_rv: single-row global checkpoint for unified-storage
	// startup recovery. Will go away when a persistent queue lands.
	vectorLatestRV := migrator.Table{
		Name: "vector_latest_rv",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_Int, IsPrimaryKey: true, Nullable: false},
			{Name: "latest_rv", Type: migrator.DB_BigInt, Nullable: false, Default: "0"},
		},
	}
	mg.AddMigration("create vector_latest_rv table",
		migrator.NewAddTableMigration(vectorLatestRV))
	mg.AddMigration("enforce single-row and seed vector_latest_rv",
		migrator.NewRawSQLMigration("").Postgres(`
			ALTER TABLE vector_latest_rv ADD CONSTRAINT vector_latest_rv_single CHECK (id = 1);
			INSERT INTO vector_latest_rv (id, latest_rv) VALUES (1, 0) ON CONFLICT DO NOTHING;
		`))
}
