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

	mg.AddMigration("create resource_embeddings table",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE TABLE IF NOT EXISTS resource_embeddings (
				id                BIGSERIAL,
				namespace         VARCHAR(256) NOT NULL,
				"group"           VARCHAR(256) NOT NULL,
				resource          VARCHAR(256) NOT NULL,
				name              VARCHAR(256) NOT NULL,
				subresource       VARCHAR(256) NOT NULL DEFAULT '',
				resource_version  BIGINT NOT NULL,
				folder            VARCHAR(256),
				content           TEXT NOT NULL,
				metadata          JSONB,
				embedding         halfvec(768) NOT NULL,
				model             VARCHAR(256) NOT NULL,
				PRIMARY KEY (namespace, model, id),
				UNIQUE (namespace, model, "group", resource, name, subresource)
			) PARTITION BY LIST (namespace);
		`))

	mg.AddMigration("create resource_embeddings HNSW index",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE INDEX IF NOT EXISTS resource_embeddings_hnsw_idx
				ON resource_embeddings USING hnsw (embedding halfvec_cosine_ops)
				WITH (m = 16, ef_construction = 64);
		`))

	mg.AddMigration("create resource_embeddings GIN metadata index",
		migrator.NewRawSQLMigration("").Postgres(`
			CREATE INDEX IF NOT EXISTS resource_embeddings_metadata_idx
				ON resource_embeddings USING GIN (metadata);
		`))
}
