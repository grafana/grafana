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
	"k8s.io/apimachinery/pkg/types"
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
	TagCacheTTL      time.Duration
	TagCacheSize     int
}

// PostgreSQLStore implements the Store interface using PostgreSQL as the backend
type PostgreSQLStore struct {
	pool     *pgxpool.Pool
	config   PostgreSQLStoreConfig
	tagCache *tagCache
	logger   log.Logger
	metrics  *Metrics
}

var _ Store = (*PostgreSQLStore)(nil)
var _ TagProvider = (*PostgreSQLStore)(nil)
var _ LifecycleManager = (*PostgreSQLStore)(nil)

// NewPostgreSQLStore creates a new PostgreSQL-backed annotation store
func NewPostgreSQLStore(ctx context.Context, cfg PostgreSQLStoreConfig, metrics *Metrics) (*PostgreSQLStore, error) {
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
		metrics:  metrics,
	}

	return store, nil
}

// Close closes the database connection pool
func (s *PostgreSQLStore) Close() error {
	if s.pool != nil {
		s.pool.Close()
	}
	return nil
}

// Get retrieves a single annotation by namespace and name
func (s *PostgreSQLStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	query := `
		SELECT namespace, name, time, time_end, dashboard_uid, panel_id,
		       text, tags, scopes, created_by, created_at, legacy_id, legacy_data, deleted_at
		FROM annotations
		WHERE namespace = $1 AND name = $2
		LIMIT 1
	`

	row := s.pool.QueryRow(ctx, query, namespace, name)

	var (
		ns, n, text  string
		timeMs       int64
		createdAt    time.Time
		timeEnd      *int64
		dashboardUID *string
		panelID      *int64
		tags, scopes []string
		createdBy    *string
		legacyID     *int64
		legacyData   *string
		deletedAt    *time.Time
	)

	err := row.Scan(&ns, &n, &timeMs, &timeEnd, &dashboardUID, &panelID,
		&text, &tags, &scopes, &createdBy, &createdAt, &legacyID, &legacyData, &deletedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to scan annotation: %w", err)
	}

	return rowToAnnotation(ns, n, timeMs, timeEnd, dashboardUID, panelID, text, tags, scopes, createdBy, createdAt, legacyID, legacyData, deletedAt), nil
}

// Create creates a new annotation
func (s *PostgreSQLStore) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
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
	createdAt := time.Now().UTC()

	var legacyID *int64
	if id := GetLegacyID(anno); id > 0 {
		legacyID = &id
	}

	var legacyData *string
	if d, ok := GetLegacyData(anno); ok {
		legacyData = &d
	}

	query := `
		INSERT INTO annotations
		(namespace, name, time, time_end, dashboard_uid, panel_id, text, tags, scopes, created_by, created_at, legacy_id, legacy_data)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := s.pool.Exec(ctx, query,
		namespace, name, timeMs, timeEnd, dashboardUID, panelID,
		text, pq.Array(tags), pq.Array(scopes), createdBy, createdAt, legacyID, legacyData,
	)
	if err != nil {
		// Check for unique constraint violation
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("%w: %s/%s", ErrAlreadyExists, namespace, name)
		}
		return nil, fmt.Errorf("failed to insert annotation: %w", err)
	}

	return anno, nil
}

// Update updates an existing annotation (only mutable fields: text, tags, scopes, legacy_data)
func (s *PostgreSQLStore) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	var legacyData *string
	if d, ok := GetLegacyData(anno); ok {
		legacyData = &d
	}

	query := `
		UPDATE annotations
		SET text = $1, tags = $2, scopes = $3, legacy_data = $4
		WHERE namespace = $5 AND name = $6 AND deleted_at IS NULL
	`

	result, err := s.pool.Exec(ctx, query,
		anno.Spec.Text,
		pq.Array(anno.Spec.Tags),
		pq.Array(anno.Spec.Scopes),
		legacyData,
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

// Delete soft-deletes a live annotation by setting the deleted_at timestamp
func (s *PostgreSQLStore) Delete(ctx context.Context, namespace, name string) error {
	query := `
		UPDATE annotations
		SET deleted_at = $1
		WHERE namespace = $2 AND name = $3 AND deleted_at IS NULL
	`

	result, err := s.pool.Exec(ctx, query, time.Now().UTC(), namespace, name)
	if err != nil {
		return fmt.Errorf("failed to delete annotation: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrNotFound
	}

	return nil
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
			ns, n, text  string
			timeMs       int64
			createdAt    time.Time
			timeEnd      *int64
			dashboardUID *string
			panelID      *int64
			tags, scopes []string
			createdBy    *string
			legacyID     *int64
			legacyData   *string
			deletedAt    *time.Time
		)

		err := rows.Scan(&ns, &n, &timeMs, &timeEnd, &dashboardUID, &panelID,
			&text, &tags, &scopes, &createdBy, &createdAt, &legacyID, &legacyData, &deletedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan annotation row: %w", err)
		}

		results = append(results, *rowToAnnotation(ns, n, timeMs, timeEnd, dashboardUID, panelID, text, tags, scopes, createdBy, createdAt, legacyID, legacyData, deletedAt))
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

	// Filter on soft-delete state.
	switch opts.Deleted {
	case DeletedOnly:
		conditions = append(conditions, "deleted_at IS NOT NULL")
	case DeletedInclude:
		// no filter, including both live and tombstoned rows
	default:
		// default to live rows only
		conditions = append(conditions, "deleted_at IS NULL")
	}

	// Time range filters
	if opts.To > 0 {
		conditions = append(conditions, fmt.Sprintf("time <= $%d", argNum))
		args = append(args, opts.To)
		argNum++
	}

	if opts.From > 0 {
		// Check against time for point annotations and time_end for range annotations
		conditions = append(conditions, fmt.Sprintf("((time_end IS NULL AND time >= $%d) OR (time_end IS NOT NULL AND time_end >= $%d))", argNum, argNum))
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

	// Deprecated internal ID filter
	if opts.LegacyID > 0 {
		conditions = append(conditions, fmt.Sprintf("legacy_id = $%d", argNum))
		args = append(args, opts.LegacyID)
		argNum++
	}

	// Construct query
	query := `
		SELECT namespace, name, time, time_end, dashboard_uid, panel_id,
		       text, tags, scopes, created_by, created_at, legacy_id, legacy_data, deleted_at
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
	createdBy *string, createdAt time.Time, legacyID *int64, legacyData *string, deletedAt *time.Time) *annotationV0.Annotation {
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			UID:       types.UID(name),
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

	// Set creation timestamp and deletion timestamp if present
	anno.CreationTimestamp = metav1.NewTime(createdAt)
	if deletedAt != nil {
		ts := metav1.NewTime(*deletedAt)
		anno.DeletionTimestamp = &ts
	}

	// Populate the legacy ID label if the column has a value
	if legacyID != nil && *legacyID != 0 {
		SetLegacyID(anno, *legacyID)
	}

	// Populate the legacy data annotation if the column has a value
	if legacyData != nil {
		SetLegacyData(anno, *legacyData)
	}

	return anno
}
