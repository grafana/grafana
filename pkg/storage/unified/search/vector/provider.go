package vector

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func ProvideVectorBackend(cfg *setting.Cfg) (VectorBackend, error) {
	return InitVectorBackend(context.Background(), cfg, true)
}

// InitVectorBackend creates a pgvectorBackend from the [database_vector]
// config section. It opens a connection to the separate pgvector database
// and returns a ready-to-use VectorBackend. When runMigrations is true, the
// schema migrations are applied before the backend is returned.
//
// Returns (nil, nil) if the vector backend is disabled via the
// [unified_storage] vector_backend flag. Returns an error if the flag is
// enabled but VectorDBHost is unset, so silent misconfiguration fails loud.
func InitVectorBackend(ctx context.Context, cfg *setting.Cfg, runMigrations bool) (VectorBackend, error) {
	if !cfg.EnableVectorBackend {
		return nil, nil
	}
	if cfg.VectorDBHost == "" {
		return nil, fmt.Errorf("vector backend is enabled but [database_vector] db_host is not set")
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

// NewSweeperForBackend returns a Sweeper that shares the given backend's DB
// connection. Callers (e.g. module_server) should call this only on targets
// that own the vector schema — otherwise `CREATE INDEX CONCURRENTLY` will
// fail under read-only credentials.
//
// Returns nil if the backend is nil (vector feature disabled).
func NewSweeperForBackend(backend VectorBackend, threshold int, interval time.Duration) *Sweeper {
	if backend == nil {
		return nil
	}
	pg, ok := backend.(*pgvectorBackend)
	if !ok {
		return nil
	}
	return NewSweeper(pg.db, threshold, interval)
}
