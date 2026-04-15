package vector

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// ProvideVectorBackend creates a pgvectorBackend from the [database_vector]
// config section. It opens a connection to the separate pgvector database,
// runs migrations, and returns a ready-to-use VectorBackend.
//
// Returns (nil, nil) if vector storage is not configured.
func ProvideVectorBackend(ctx context.Context, cfg *setting.Cfg) (VectorBackend, error) {
	if cfg.VectorDBHost == "" {
		return nil, nil
	}

	logger := log.New("vector-db")

	connStr := fmt.Sprintf("host=%s dbname=%s user=%s password=%s sslmode=%s",
		cfg.VectorDBHost, cfg.VectorDBName, cfg.VectorDBUser, cfg.VectorDBPassword, cfg.VectorDBSSLMode,
	)

	engine, err := xorm.NewEngine("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("open vector database: %w", err)
	}

	logger.Info("Running vector database migrations")
	if err := MigrateVectorStore(ctx, engine, cfg); err != nil {
		return nil, fmt.Errorf("migrate vector database: %w", err)
	}

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	return NewPgvectorBackend(database), nil
}
