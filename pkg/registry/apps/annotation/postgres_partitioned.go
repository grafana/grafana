package annotation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lib/pq"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	defaultMaxConnections  = 10
	defaultMaxIdleConns    = 5
	defaultConnMaxLifetime = time.Hour
	defaultTagCacheTTL     = 60 * time.Second
	defaultTagCacheSize    = 1000
)

type PostgreSQLStoreConfig struct {
	ConnectionString string
	MaxConnections   int
	MaxIdleConns     int
	ConnMaxLifetime  time.Duration
	RetentionTTL     time.Duration
	TagCacheTTL      time.Duration
	TagCacheSize     int
}

// PostgreSQLStore implements the Store interface using PostgreSQL as the backend
type PostgreSQLStore struct {
	pool     *pgxpool.Pool
	config   PostgreSQLStoreConfig
	tagCache *tagCache
	logger   log.Logger
}

var _ Store = (*PostgreSQLStore)(nil)
var _ TagProvider = (*PostgreSQLStore)(nil)
var _ LifecycleManager = (*PostgreSQLStore)(nil)

// NewPostgreSQLStore creates a new PostgreSQL-backed annotation store
func NewPostgreSQLStore(ctx context.Context, cfg PostgreSQLStoreConfig) (*PostgreSQLStore, error) {
	if cfg.MaxConnections == 0 {
		cfg.MaxConnections = defaultMaxConnections
	}
	if cfg.MaxIdleConns == 0 {
		cfg.MaxIdleConns = defaultMaxIdleConns
	}
	if cfg.ConnMaxLifetime == 0 {
		cfg.ConnMaxLifetime = defaultConnMaxLifetime
	}
	if cfg.TagCacheTTL == 0 {
		cfg.TagCacheTTL = defaultTagCacheTTL
	}
	if cfg.TagCacheSize == 0 {
		cfg.TagCacheSize = defaultTagCacheSize
	}

	// Create connection pool
	poolConfig, err := pgxpool.ParseConfig(cfg.ConnectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse connection string: %w", err)
	}

	poolConfig.MaxConns = int32(cfg.MaxConnections)
	poolConfig.MinConns = int32(cfg.MaxIdleConns)
	poolConfig.MaxConnLifetime = cfg.ConnMaxLifetime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger := log.New("postgres.annotation.store")

	// Run database migrations
	if err := runMigrations(ctx, pool, logger); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize tag cache
	// NOTE: We currently do _not_ invalidate the tag cache and rely on TTL expiration to keep things simple,
	// but we could consider more aggressive invalidation on writes if we find the cache is too stale in practice.
	// The current default TTL is 60 seconds.
	cache, err := newTagCache(cfg.TagCacheSize, cfg.TagCacheTTL)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to create tag cache: %w", err)
	}

	store := &PostgreSQLStore{
		pool:     pool,
		config:   cfg,
		tagCache: cache,
		logger:   logger,
	}

	return store, nil
}

// Close closes the database connection pool
func (s *PostgreSQLStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// Get retrieves a single annotation by namespace and name.
// Uses the annotation_keys table to look up the time value, enabling direct partition targeting.
func (s *PostgreSQLStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	query := `
		SELECT a.namespace, a.name, a.time, a.time_end, a.dashboard_uid, a.panel_id,
		       a.text, a.tags, a.scopes, a.created_by, a.created_at
		FROM annotation_keys k
		INNER JOIN annotations a ON a.namespace = k.namespace AND a.name = k.name AND a.time = k.time
		WHERE k.namespace = $1 AND k.name = $2
	`

	row := s.pool.QueryRow(ctx, query, namespace, name)

	var (
		ns, n, text       string
		timeMs, createdAt int64
		timeEnd           *int64
		dashboardUID      *string
		panelID           *int64
		tags, scopes      []string
		createdBy         *string
	)

	err := row.Scan(&ns, &n, &timeMs, &timeEnd, &dashboardUID, &panelID,
		&text, &tags, &scopes, &createdBy, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to scan annotation: %w", err)
	}

	return rowToAnnotation(ns, n, timeMs, timeEnd, dashboardUID, panelID, text, tags, scopes, createdBy, createdAt), nil
}

// Create creates a new annotation
func (s *PostgreSQLStore) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	if err := s.validateAnnotation(anno); err != nil {
		return nil, err
	}

	// Ensure partition exists for this timestamp
	if err := ensurePartition(ctx, s.pool, s.logger, anno.Spec.Time); err != nil {
		return nil, fmt.Errorf("failed to ensure partition: %w", err)
	}

	namespace := anno.Namespace
	name := anno.Name
	timeMs := anno.Spec.Time
	timeEnd := anno.Spec.TimeEnd
	dashboardUID := anno.Spec.DashboardUID
	panelID := anno.Spec.PanelID
	text := anno.Spec.Text
	tags := anno.Spec.Tags
	scopes := anno.Spec.Scopes
	createdBy := anno.GetCreatedBy()
	createdAt := time.Now().UTC().UnixMilli()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Insert into annotation_keys first to enforce namespace+name uniqueness
	keyQuery := `INSERT INTO annotation_keys (namespace, name, time) VALUES ($1, $2, $3)`
	if _, err := tx.Exec(ctx, keyQuery, namespace, name, timeMs); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("annotation with name %q already exists: %w", name, err)
		}
		return nil, fmt.Errorf("failed to insert annotation key: %w", err)
	}

	// Insert into partitioned annotations table
	annoQuery := `
		INSERT INTO annotations
		(namespace, name, time, time_end, dashboard_uid, panel_id, text, tags, scopes, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	if _, err := tx.Exec(ctx, annoQuery,
		namespace, name, timeMs, timeEnd, dashboardUID, panelID,
		text, pq.Array(tags), pq.Array(scopes), createdBy, createdAt,
	); err != nil {
		return nil, fmt.Errorf("failed to insert annotation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return anno, nil
}

// Update updates an existing annotation (only mutable fields: text, tags, scopes).
// Uses the annotation_keys table to target the correct partition directly.
func (s *PostgreSQLStore) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	query := `
		UPDATE annotations a
		SET text = $1, tags = $2, scopes = $3
		FROM annotation_keys k
		WHERE a.namespace = k.namespace AND a.name = k.name AND a.time = k.time
		  AND k.namespace = $4 AND k.name = $5
	`

	result, err := s.pool.Exec(ctx, query,
		anno.Spec.Text,
		pq.Array(anno.Spec.Tags),
		pq.Array(anno.Spec.Scopes),
		anno.Namespace,
		anno.Name,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update annotation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	return anno, nil
}

// Delete deletes an annotation from both the partitioned table and the key lookup table.
func (s *PostgreSQLStore) Delete(ctx context.Context, namespace, name string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	// Delete from annotations using the key table for partition targeting
	annoQuery := `
		DELETE FROM annotations a
		USING annotation_keys k
		WHERE a.namespace = k.namespace AND a.name = k.name AND a.time = k.time
		  AND k.namespace = $1 AND k.name = $2
	`
	result, err := tx.Exec(ctx, annoQuery, namespace, name)
	if err != nil {
		return fmt.Errorf("failed to delete annotation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	// Delete from annotation_keys
	keyQuery := `DELETE FROM annotation_keys WHERE namespace = $1 AND name = $2`
	if _, err := tx.Exec(ctx, keyQuery, namespace, name); err != nil {
		return fmt.Errorf("failed to delete annotation key: %w", err)
	}

	return tx.Commit(ctx)
}

// List lists annotations based on the provided options
func (s *PostgreSQLStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	// Decode continue token and validate limit
	offset := int64(0)
	if opts.Continue != "" {
		token, err := decodeContinueToken(opts.Continue)
		if err != nil {
			return nil, err
		}
		if token.Limit != opts.Limit {
			return nil, fmt.Errorf("continue token limit does not match the request limit")
		}
		offset = token.Offset
	}

	// Build query
	limit := opts.Limit
	if limit == 0 {
		limit = 100 // default limit
	}
	query, args := buildListQuery(namespace, opts, offset, limit)

	// Execute query
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query annotations: %w", err)
	}
	defer rows.Close()

	var results []annotationV0.Annotation
	for rows.Next() {
		var (
			ns, n, text       string
			timeMs, createdAt int64
			timeEnd           *int64
			dashboardUID      *string
			panelID           *int64
			tags, scopes      []string
			createdBy         *string
		)

		err := rows.Scan(&ns, &n, &timeMs, &timeEnd, &dashboardUID, &panelID,
			&text, &tags, &scopes, &createdBy, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan annotation row: %w", err)
		}

		results = append(results, *rowToAnnotation(ns, n, timeMs, timeEnd, dashboardUID, panelID, text, tags, scopes, createdBy, createdAt))
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating annotation rows: %w", err)
	}

	// Handle pagination
	var continueToken string
	if int64(len(results)) > limit {
		// More results available
		results = results[:limit]
		continueToken = encodeContinueToken(offset+limit, limit)
	}

	return &AnnotationList{
		Items:    results,
		Continue: continueToken,
	}, nil
}

// buildListQuery constructs the SQL query and arguments for List
func buildListQuery(namespace string, opts ListOptions, offset, limit int64) (string, []any) {
	var conditions []string
	var args []any
	argNum := 1

	// Namespace is always required
	conditions = append(conditions, fmt.Sprintf("namespace = $%d", argNum))
	args = append(args, namespace)
	argNum++

	// Time range filters
	if opts.To > 0 {
		conditions = append(conditions, fmt.Sprintf("time <= $%d", argNum))
		args = append(args, opts.To)
		argNum++
	}

	if opts.From > 0 {
		// Range overlap: annotation's time_end is NULL (point) OR time_end >= from
		conditions = append(conditions, fmt.Sprintf("(time_end IS NULL OR time_end >= $%d)", argNum))
		args = append(args, opts.From)
		argNum++
	}

	// Dashboard filter
	if opts.DashboardUID != "" {
		conditions = append(conditions, fmt.Sprintf("dashboard_uid = $%d", argNum))
		args = append(args, opts.DashboardUID)
		argNum++
	}

	// Panel filter
	if opts.PanelID != 0 {
		conditions = append(conditions, fmt.Sprintf("panel_id = $%d", argNum))
		args = append(args, opts.PanelID)
		argNum++
	}

	// CreatedBy filter
	if opts.CreatedBy != "" {
		conditions = append(conditions, fmt.Sprintf("created_by = $%d", argNum))
		args = append(args, opts.CreatedBy)
		argNum++
	}

	// Tags filter
	if len(opts.Tags) > 0 {
		if opts.TagsMatchAny {
			// Overlaps operator: tags && $N
			conditions = append(conditions, fmt.Sprintf("tags && $%d", argNum))
		} else {
			// Contains operator: tags @> $N
			conditions = append(conditions, fmt.Sprintf("tags @> $%d", argNum))
		}
		args = append(args, pq.Array(opts.Tags))
		argNum++
	}

	// Scopes filter
	if len(opts.Scopes) > 0 {
		if opts.ScopesMatchAny {
			conditions = append(conditions, fmt.Sprintf("scopes && $%d", argNum))
		} else {
			conditions = append(conditions, fmt.Sprintf("scopes @> $%d", argNum))
		}
		args = append(args, pq.Array(opts.Scopes))
		argNum++
	}

	// Construct query
	query := `
		SELECT namespace, name, time, time_end, dashboard_uid, panel_id,
		       text, tags, scopes, created_by, created_at
		FROM annotations
		WHERE ` + strings.Join(conditions, " AND ") + `
		ORDER BY time DESC, name
	`

	// Add pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit+1, offset) // Request one extra to detect more results for pagination

	return query, args
}

// rowToAnnotation converts database row values to an Annotation object
func rowToAnnotation(namespace, name string, timeMs int64, timeEnd *int64,
	dashboardUID *string, panelID *int64, text string, tags, scopes []string,
	createdBy *string, createdAt int64) *annotationV0.Annotation {
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: annotationV0.AnnotationSpec{
			Time:         timeMs,
			TimeEnd:      timeEnd,
			DashboardUID: dashboardUID,
			PanelID:      panelID,
			Text:         text,
			Tags:         tags,
			Scopes:       scopes,
		},
	}

	// Set createdBy if present
	if createdBy != nil && *createdBy != "" {
		anno.SetCreatedBy(*createdBy)
	}

	// Set creation timestamp
	anno.CreationTimestamp = metav1.NewTime(time.UnixMilli(createdAt))

	return anno
}

func (s *PostgreSQLStore) validateAnnotation(anno *annotationV0.Annotation) error {
	now := time.Now().UTC()
	// TODO: determine appropriate future bound and maybe make configurable
	maxFuture := now.Add(7 * 24 * time.Hour).UnixMilli()
	maxPast := now.Add(-s.config.RetentionTTL).UnixMilli()

	if anno.Spec.Time > maxFuture {
		return fmt.Errorf("annotation time cannot be more than 1 week in the future")
	}
	if anno.Spec.Time < maxPast {
		return fmt.Errorf("annotation time cannot be older than retention TTL (%v)", s.config.RetentionTTL)
	}

	// If timeEnd is set, validate it's after time and within future bounds
	if anno.Spec.TimeEnd != nil {
		if *anno.Spec.TimeEnd < anno.Spec.Time {
			return fmt.Errorf("annotation timeEnd must be after time")
		}
		if *anno.Spec.TimeEnd > maxFuture {
			return fmt.Errorf("annotation timeEnd cannot be more than 1 week in the future")
		}
	}

	return nil
}
