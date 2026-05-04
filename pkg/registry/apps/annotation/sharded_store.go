package annotation

import (
	"context"
	"fmt"
	"strings"
	"time"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ShardedStoreConfig holds the configuration for a sharded PostgreSQL store.
type ShardedStoreConfig struct {
	// ShardConnectionStrings are the connection strings for each data shard, ordered by shard index.
	ShardConnectionStrings []string

	// MetadataConnectionString is the connection string for the dedicated metadata database.
	MetadataConnectionString string

	// Per-shard PostgreSQL settings (applied uniformly to all shards)
	MaxConnections  int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	RetentionTTL    time.Duration
	TagCacheTTL     time.Duration
	TagCacheSize    int
}

// ShardedPostgresStore implements Store, TagProvider, and LifecycleManager by routing
// requests to one of N PostgreSQLStore instances based on namespace.
//
// Shard assignments are persisted in a dedicated metadata database. Once a
// namespace is assigned to a shard, it stays there. Adding new shards does not
// remap existing tenants — only new namespaces will be assigned to the expanded
// shard set.
type ShardedPostgresStore struct {
	shards       []*PostgreSQLStore
	metadataPool *pgxpool.Pool
	resolver     *shardAssignmentResolver
	logger       log.Logger
}

var _ Store = (*ShardedPostgresStore)(nil)
var _ TagProvider = (*ShardedPostgresStore)(nil)
var _ LifecycleManager = (*ShardedPostgresStore)(nil)

// NewShardedPostgresStore creates a sharded store backed by multiple PostgreSQL databases.
// A dedicated metadata database stores namespace-to-shard assignments.
func NewShardedPostgresStore(ctx context.Context, cfg ShardedStoreConfig) (*ShardedPostgresStore, error) {
	if len(cfg.ShardConnectionStrings) == 0 {
		return nil, fmt.Errorf("at least one shard connection string is required")
	}
	if cfg.MetadataConnectionString == "" {
		return nil, fmt.Errorf("metadata connection string is required")
	}

	logger := log.New("sharded.annotation.store")

	metadataPool, err := createMetadataPool(ctx, cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata pool: %w", err)
	}

	shards := make([]*PostgreSQLStore, len(cfg.ShardConnectionStrings))
	for i, connStr := range cfg.ShardConnectionStrings {
		pgCfg := PostgreSQLStoreConfig{
			ConnectionString: connStr,
			MaxConnections:   cfg.MaxConnections,
			MaxIdleConns:     cfg.MaxIdleConns,
			ConnMaxLifetime:  cfg.ConnMaxLifetime,
			RetentionTTL:     cfg.RetentionTTL,
			TagCacheTTL:      cfg.TagCacheTTL,
			TagCacheSize:     cfg.TagCacheSize,
		}

		store, err := NewPostgreSQLStore(ctx, pgCfg)
		if err != nil {
			for j := 0; j < i; j++ {
				shards[j].Close()
			}
			metadataPool.Close()
			return nil, fmt.Errorf("failed to create shard %d: %w", i, err)
		}
		shards[i] = store
	}

	resolver := newShardAssignmentResolver(metadataPool, len(shards), logger)

	if err := resolver.preloadAssignments(ctx); err != nil {
		for _, shard := range shards {
			shard.Close()
		}
		metadataPool.Close()
		return nil, fmt.Errorf("failed to preload shard assignments: %w", err)
	}

	logger.Info("Initialized sharded annotation store",
		"shard_count", len(shards),
	)

	return &ShardedPostgresStore{
		shards:       shards,
		metadataPool: metadataPool,
		resolver:     resolver,
		logger:       logger,
	}, nil
}

func createMetadataPool(ctx context.Context, cfg ShardedStoreConfig, logger log.Logger) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.MetadataConnectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse metadata connection string: %w", err)
	}

	// The metadata DB is lightweight, so a small connection pool is sufficient
	poolConfig.MaxConns = 5
	poolConfig.MinConns = 1
	poolConfig.MaxConnLifetime = cfg.ConnMaxLifetime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping metadata database: %w", err)
	}

	if err := runMetadataMigrations(ctx, pool, logger); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to run metadata migrations: %w", err)
	}

	return pool, nil
}

// Close closes all underlying connections.
func (s *ShardedPostgresStore) Close() {
	for _, shard := range s.shards {
		shard.Close()
	}
	if s.metadataPool != nil {
		s.metadataPool.Close()
	}
}

// shardFor returns the shard for a given namespace by resolving its assignment.
func (s *ShardedPostgresStore) shardFor(ctx context.Context, namespace string) (*PostgreSQLStore, error) {
	idx, err := s.resolver.resolve(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve shard for namespace %q: %w", namespace, err)
	}
	if idx < 0 || idx >= len(s.shards) {
		return nil, fmt.Errorf("shard index %d out of range for namespace %q (have %d shards)", idx, namespace, len(s.shards))
	}
	return s.shards[idx], nil
}

// Get retrieves an annotation, routing to the correct shard by namespace.
func (s *ShardedPostgresStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	shard, err := s.shardFor(ctx, namespace)
	if err != nil {
		return nil, err
	}
	return shard.Get(ctx, namespace, name)
}

// Create creates an annotation on the correct shard.
func (s *ShardedPostgresStore) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	shard, err := s.shardFor(ctx, anno.Namespace)
	if err != nil {
		return nil, err
	}
	return shard.Create(ctx, anno)
}

// Update updates an annotation on the correct shard.
func (s *ShardedPostgresStore) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	shard, err := s.shardFor(ctx, anno.Namespace)
	if err != nil {
		return nil, err
	}
	return shard.Update(ctx, anno)
}

// Delete deletes an annotation from the correct shard.
func (s *ShardedPostgresStore) Delete(ctx context.Context, namespace, name string) error {
	shard, err := s.shardFor(ctx, namespace)
	if err != nil {
		return err
	}
	return shard.Delete(ctx, namespace, name)
}

// List lists annotations from the correct shard.
func (s *ShardedPostgresStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	shard, err := s.shardFor(ctx, namespace)
	if err != nil {
		return nil, err
	}
	return shard.List(ctx, namespace, opts)
}

// ListTags returns tags from the correct shard.
func (s *ShardedPostgresStore) ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	shard, err := s.shardFor(ctx, namespace)
	if err != nil {
		return nil, err
	}
	return shard.ListTags(ctx, namespace, opts)
}

// Cleanup runs partition cleanup on all shards.
func (s *ShardedPostgresStore) Cleanup(ctx context.Context) (int64, error) {
	var total int64
	var errs []string
	for i, shard := range s.shards {
		deleted, err := shard.Cleanup(ctx)
		if err != nil {
			errs = append(errs, fmt.Sprintf("shard %d: %v", i, err))
			continue
		}
		total += deleted
	}
	if len(errs) > 0 {
		return total, fmt.Errorf("cleanup errors: %s", strings.Join(errs, "; "))
	}
	return total, nil
}
