package vector

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// MigrateVectorStore runs migrations for the vector database.
//
// LIST partitioning by resource. Each resource gets a leaf table:
//
//	embeddings                  PARTITION BY LIST (resource)
//	└── embeddings_dashboards   leaf — all dashboard rows live here
//	    + partial HNSW per namespace for promoted (big) tenants
//	    + base GIN(metadata)
//
// Future resource subtrees will be attached at runtime via advisory-lock.
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
		migrator.NewRawSQLMigration("").Postgres(`DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
		CREATE EXTENSION vector;
	END IF;
END $$;`))

	// (resource, namespace) lead the PK so partition pruning can use it.
	// halfvec + nested partitioning aren't expressible via xorm, so raw SQL.
	mg.AddMigration("create embeddings parent",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE TABLE IF NOT EXISTS embeddings (
				id BIGSERIAL,
				resource VARCHAR(256) NOT NULL,
				namespace VARCHAR(256) NOT NULL,
				model VARCHAR(256) NOT NULL,
				uid VARCHAR(256) NOT NULL,
				title VARCHAR(1024) NOT NULL,
				subresource VARCHAR(256) NOT NULL DEFAULT '',
				folder VARCHAR(256),
				content TEXT NOT NULL,
				metadata JSONB,
				embedding halfvec(1024) NOT NULL,
				PRIMARY KEY (resource, namespace, model, uid, subresource)
			) PARTITION BY LIST (resource);
		`))

	mg.AddMigration("create embeddings_dashboards leaf",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE TABLE IF NOT EXISTS embeddings_dashboards
				PARTITION OF embeddings
				FOR VALUES IN ('dashboards');
		`))

	mg.AddMigration("create metadata GIN on embeddings_dashboards",
		migrator.NewRawSQLMigration("").Postgres(
			`CREATE INDEX IF NOT EXISTS embeddings_dashboards_metadata_idx
				ON embeddings_dashboards USING GIN (metadata);`,
		))

	// Observability log. pg_inherits is the source of truth for leaf existence.
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

	// Single-row global checkpoint for startup recovery. Retired once we
	// have a persistent queue.
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

	// One row per backfill job. Operators add a row with is_complete=false
	// to kick off a backfill (e.g. on a model rollout, or when adding a
	// new resource type later). resource='' means "every registered
	// Builder for this model"; a non-empty resource targets that one
	// Builder, useful when adding a new resource type after an earlier
	// (model, '') job has already embedded everything else.
	backfillJobs := migrator.Table{
		Name: "vector_backfill_jobs",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true, Nullable: false},
			{Name: "model", Type: migrator.DB_Varchar, Length: 256, Nullable: false},
			{Name: "resource", Type: migrator.DB_Varchar, Length: 256, Nullable: false, Default: "''"},
			{Name: "stopping_rv", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "last_seen_key", Type: migrator.DB_Text, Nullable: true},
			{Name: "is_complete", Type: migrator.DB_Bool, Nullable: false, Default: "false"},
			{Name: "started_at", Type: migrator.DB_TimeStampz, Nullable: false, Default: "CURRENT_TIMESTAMP"},
			{Name: "updated_at", Type: migrator.DB_TimeStampz, Nullable: false, Default: "CURRENT_TIMESTAMP"},
			{Name: "last_error", Type: migrator.DB_Text, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"model", "resource"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create vector_backfill_jobs table",
		migrator.NewAddTableMigration(backfillJobs))
	mg.AddMigration("create vector_backfill_jobs (model, resource) index",
		migrator.NewAddIndexMigration(backfillJobs, backfillJobs.Indices[0]))

	mg.AddMigration("create query_embedding_cache",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE TABLE IF NOT EXISTS query_embedding_cache (
				namespace VARCHAR(256) NOT NULL,
				model VARCHAR(256) NOT NULL,
				query_hash CHAR(64) NOT NULL,
				embedding halfvec(1024) NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (namespace, model, query_hash)
			);
		`))
	mg.AddMigration("create query_embedding_cache eviction index",
		migrator.NewRawSQLMigration("").Postgres(
			`CREATE INDEX IF NOT EXISTS query_embedding_cache_eviction_idx
				ON query_embedding_cache (namespace, created_at);`,
		))

	rateBuckets := migrator.Table{
		Name: "vector_search_rate_buckets",
		Columns: []*migrator.Column{
			{Name: "namespace", Type: migrator.DB_Varchar, Length: 256, Nullable: false, IsPrimaryKey: true},
			{Name: "window_start", Type: migrator.DB_TimeStampz, Nullable: false, IsPrimaryKey: true},
			{Name: "request_count", Type: migrator.DB_BigInt, Nullable: false, Default: "0"},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"window_start"}, Type: migrator.IndexType},
		},
	}
	mg.AddMigration("create vector_search_rate_buckets",
		migrator.NewAddTableMigration(rateBuckets))
	mg.AddMigration("create vector_search_rate_buckets window_start index",
		migrator.NewAddIndexMigration(rateBuckets, rateBuckets.Indices[0]))
}
