package vector

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// ProvideVectorBackendForServer is a wire-friendly wrapper used by the
// monolithic Grafana server (targets `all`/`core`, or the bare
// `grafana-server` binary). The single pod is both reader and writer, so
// it always runs migrations. Split-mode callers (target=storage-server,
// target=search-server) use ProvideVectorBackend directly from the module
// server so the migration gate can follow the pod's role.
func ProvideVectorBackendForServer(cfg *setting.Cfg) (VectorBackend, error) {
	return ProvideVectorBackend(context.Background(), cfg, true)
}

// ProvideVectorBackend creates a pgvectorBackend from the [database_vector]
// config section. It opens a connection to the separate pgvector database
// and returns a ready-to-use VectorBackend. When runMigrations is true, the
// schema migrations are applied before the backend is returned.
//
// Returns (nil, nil) if vector search is disabled via the
// [unified_storage] enable_vector_search flag. Returns an error if the flag
// is enabled but VectorDBHost is unset, so silent misconfiguration fails loud.
func ProvideVectorBackend(ctx context.Context, cfg *setting.Cfg, runMigrations bool) (VectorBackend, error) {
	if !cfg.EnableVectorSearch {
		return nil, nil
	}
	if cfg.VectorDBHost == "" {
		return nil, fmt.Errorf("vector search is enabled but [database_vector] db_host is not set")
	}

	logger := log.New("vector-db")

	connStr := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=%s",
		cfg.VectorDBHost, cfg.VectorDBPort, cfg.VectorDBName, cfg.VectorDBUser, cfg.VectorDBPassword, cfg.VectorDBSSLMode,
	)

	engine, err := xorm.NewEngine("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("open vector database: %w", err)
	}

	if runMigrations {
		logger.Info("Running vector database migrations")
		if err := MigrateVectorStore(ctx, engine, cfg); err != nil {
			return nil, fmt.Errorf("migrate vector database: %w", err)
		}
	} else {
		logger.Info("Skipping vector database migrations (not eligible on this target)")
	}

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	return NewPgvectorBackend(database), nil
}
