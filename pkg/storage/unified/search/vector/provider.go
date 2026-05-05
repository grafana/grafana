package vector

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func ProvideVectorBackend(cfg *setting.Cfg) (VectorBackend, error) {
	return InitVectorBackend(context.Background(), cfg, true)
}

func InitVectorBackend(ctx context.Context, cfg *setting.Cfg, ownsSchema bool) (VectorBackend, error) {
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

	if ownsSchema {
		logger.Info("Running vector database migrations")
		if err := MigrateVectorStore(ctx, engine, cfg); err != nil {
			return nil, fmt.Errorf("migrate vector database: %w", err)
		}
	} else {
		logger.Info("Skipping vector database migrations")
	}

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())

	// Pass the engine as the GC keep-alive — without this the local
	// `engine` goes out of scope when this function returns, and xorm's
	// finalizer eventually closes the underlying *sql.DB while the
	// backfiller / promoter are still using it.
	return NewPgvectorBackend(ctx, database, cfg.VectorPromotionThreshold, cfg.VectorPromoterInterval, ownsSchema, engine), nil
}
