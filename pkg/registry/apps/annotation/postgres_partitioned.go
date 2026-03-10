package annotation

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/lib/pq"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	// ErrNotFound is returned when an annotation is not found
	ErrNotFound = errors.New("annotation not found")
	// ErrAlreadyExists is returned when trying to create an annotation that already exists
	ErrAlreadyExists = errors.New("annotation already exists")
	// ErrInvalidName is returned when an annotation name is missing or invalid
	ErrInvalidName = errors.New("annotation name is required")
)

// PostgreSQLStoreConfig holds configuration for the PostgreSQL store
type PostgreSQLStoreConfig struct {
	// DB is the database connection pool
	DB *sql.DB
	// RetentionTTL is how long to keep annotations before cleanup (default: 90 days)
	RetentionTTL time.Duration
	// TagCacheTTL is how long to cache tag queries (default: 60 seconds)
	TagCacheTTL time.Duration
	// TagCacheSize is the maximum number of tag cache entries (default: 1000)
	TagCacheSize int
}

// postgresStore implements Store, TagProvider, and LifecycleManager interfaces
type postgresStore struct {
	db           *sql.DB
	retentionTTL time.Duration
}

var _ Store = (*postgresStore)(nil)
var _ TagProvider = (*postgresStore)(nil)
var _ LifecycleManager = (*postgresStore)(nil)

// NewPostgreSQLStore creates a new PostgreSQL-backed annotation store
func NewPostgreSQLStore(ctx context.Context, cfg PostgreSQLStoreConfig) (Store, error) {
	if cfg.DB == nil {
		return nil, fmt.Errorf("database connection is required")
	}

	// Set defaults
	if cfg.RetentionTTL == 0 {
		cfg.RetentionTTL = 90 * 24 * time.Hour // 90 days
	}
	if cfg.TagCacheTTL == 0 {
		cfg.TagCacheTTL = 60 * time.Second
	}
	if cfg.TagCacheSize == 0 {
		cfg.TagCacheSize = 1000
	}

	// Verify PostgreSQL version >= 10 (required for declarative partitioning)
	var version string
	if err := cfg.DB.QueryRowContext(ctx, "SHOW server_version").Scan(&version); err != nil {
		return nil, fmt.Errorf("failed to check PostgreSQL version: %w", err)
	}

	// Create parent table if not exists
	if err := createParentTable(ctx, cfg.DB); err != nil {
		return nil, err
	}

	// Create tags materialized view if not exists
	if err := createTagsMaterializedView(ctx, cfg.DB); err != nil {
		return nil, err
	}

	store := &postgresStore{
		db:           cfg.DB,
		retentionTTL: cfg.RetentionTTL,
	}

	return store, nil
}

// Get retrieves a single annotation by namespace and name
func (s *postgresStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	if name == "" {
		return nil, ErrInvalidName
	}

	query := `
		SELECT namespace, name, time, time_end, dashboard_uid, panel_id,
		       text, tags, scopes, created_by, created_at
		FROM annotations
		WHERE namespace = $1 AND name = $2
		LIMIT 1
	`

	var (
		dbNamespace string
		dbName      string
		dbTime      int64
		dbTimeEnd   sql.NullInt64
		dbDashUID   sql.NullString
		dbPanelID   sql.NullInt64
		dbText      string
		dbTags      pq.StringArray
		dbScopes    pq.StringArray
		dbCreatedBy sql.NullString
		dbCreatedAt int64
	)

	err := s.db.QueryRowContext(ctx, query, namespace, name).Scan(
		&dbNamespace, &dbName, &dbTime, &dbTimeEnd, &dbDashUID, &dbPanelID,
		&dbText, &dbTags, &dbScopes, &dbCreatedBy, &dbCreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get annotation: %w", err)
	}

	return rowToAnnotation(dbNamespace, dbName, dbTime, dbTimeEnd, dbDashUID, dbPanelID,
		dbText, dbTags, dbScopes, dbCreatedBy, dbCreatedAt), nil
}

// Create creates a new annotation
func (s *postgresStore) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	if anno.Name == "" {
		return nil, ErrInvalidName
	}

	// Ensure partition exists for this annotation's time
	if err := ensurePartition(ctx, s.db, anno.Spec.Time); err != nil {
		return nil, fmt.Errorf("failed to ensure partition: %w", err)
	}

	// Prepare values
	timeEnd := sql.NullInt64{}
	if anno.Spec.TimeEnd != nil {
		timeEnd.Valid = true
		timeEnd.Int64 = *anno.Spec.TimeEnd
	}

	dashUID := sql.NullString{}
	if anno.Spec.DashboardUID != nil {
		dashUID.Valid = true
		dashUID.String = *anno.Spec.DashboardUID
	}

	panelID := sql.NullInt64{}
	if anno.Spec.PanelID != nil {
		panelID.Valid = true
		panelID.Int64 = *anno.Spec.PanelID
	}

	createdBy := sql.NullString{}
	if m, err := utils.MetaAccessor(anno); err == nil {
		if cb := m.GetCreatedBy(); cb != "" {
			createdBy.Valid = true
			createdBy.String = cb
		}
	}

	createdAt := time.Now().UnixMilli()

	insertSQL := `
		INSERT INTO annotations
		  (namespace, name, time, time_end, dashboard_uid, panel_id, text, tags, scopes, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := s.db.ExecContext(ctx, insertSQL,
		anno.Namespace,
		anno.Name,
		anno.Spec.Time,
		timeEnd,
		dashUID,
		panelID,
		anno.Spec.Text,
		pq.Array(anno.Spec.Tags),
		pq.Array(anno.Spec.Scopes),
		createdBy,
		createdAt,
	)

	if err != nil {
		// Check for unique constraint violation
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, fmt.Errorf("failed to create annotation: %w", err)
	}

	// Return the created annotation
	result := anno.DeepCopy()
	result.CreationTimestamp = metav1.NewTime(time.UnixMilli(createdAt))

	return result, nil
}

// Update updates an existing annotation
// Only mutable fields (text, tags, scopes) are updated
func (s *postgresStore) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	if anno.Name == "" {
		return nil, ErrInvalidName
	}

	updateSQL := `
		UPDATE annotations
		SET text = $1, tags = $2, scopes = $3
		WHERE namespace = $4 AND name = $5
	`

	result, err := s.db.ExecContext(ctx, updateSQL,
		anno.Spec.Text,
		pq.Array(anno.Spec.Tags),
		pq.Array(anno.Spec.Scopes),
		anno.Namespace,
		anno.Name,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update annotation: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return nil, ErrNotFound
	}

	return anno.DeepCopy(), nil
}

// Delete deletes an annotation
func (s *postgresStore) Delete(ctx context.Context, namespace, name string) error {
	if name == "" {
		return ErrInvalidName
	}

	deleteSQL := `DELETE FROM annotations WHERE namespace = $1 AND name = $2`

	result, err := s.db.ExecContext(ctx, deleteSQL, namespace, name)
	if err != nil {
		return fmt.Errorf("failed to delete annotation: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// List queries annotations with filtering and pagination
func (s *postgresStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	// Parse continue token if present
	offset := int64(0)
	if opts.Continue != "" {
		token, err := decodeContinueToken(opts.Continue)
		if err != nil {
			return nil, fmt.Errorf("invalid continue token: %w", err)
		}
		if token.Limit != opts.Limit {
			return nil, fmt.Errorf("continue token limit does not match request limit")
		}
		offset = token.Offset
	}

	// Build query dynamically based on options
	query, args := buildListQuery(namespace, opts, offset)

	// Query for limit + 1 to determine if there are more results
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list annotations: %w", err)
	}
	defer rows.Close()

	results := make([]annotationV0.Annotation, 0, opts.Limit)
	for rows.Next() {
		var (
			dbNamespace string
			dbName      string
			dbTime      int64
			dbTimeEnd   sql.NullInt64
			dbDashUID   sql.NullString
			dbPanelID   sql.NullInt64
			dbText      string
			dbTags      pq.StringArray
			dbScopes    pq.StringArray
			dbCreatedBy sql.NullString
			dbCreatedAt int64
		)

		if err := rows.Scan(
			&dbNamespace, &dbName, &dbTime, &dbTimeEnd, &dbDashUID, &dbPanelID,
			&dbText, &dbTags, &dbScopes, &dbCreatedBy, &dbCreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		anno := rowToAnnotation(dbNamespace, dbName, dbTime, dbTimeEnd, dbDashUID, dbPanelID,
			dbText, dbTags, dbScopes, dbCreatedBy, dbCreatedAt)
		results = append(results, *anno)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	// Check if there are more results
	var continueToken string
	if opts.Limit > 0 && int64(len(results)) > opts.Limit {
		results = results[:opts.Limit]
		continueToken = encodeContinueToken(offset+opts.Limit, opts.Limit)
	}

	return &AnnotationList{
		Items:    results,
		Continue: continueToken,
	}, nil
}

// buildListQuery constructs the SQL query for List operation
func buildListQuery(namespace string, opts ListOptions, offset int64) (string, []any) {
	var whereClauses []string
	var args []any
	argNum := 1

	// Namespace is always required
	whereClauses = append(whereClauses, fmt.Sprintf("namespace = $%d", argNum))
	args = append(args, namespace)
	argNum++

	// Time range filtering
	if opts.To > 0 {
		whereClauses = append(whereClauses, fmt.Sprintf("time <= $%d", argNum))
		args = append(args, opts.To)
		argNum++
	}

	// Range overlap: annotation overlaps with [from, to] if:
	// - For point annotations (time_end IS NULL): time >= from
	// - For range annotations: time_end >= from
	if opts.From > 0 {
		whereClauses = append(whereClauses, fmt.Sprintf("(time_end IS NULL OR time_end >= $%d)", argNum))
		args = append(args, opts.From)
		argNum++
	}

	// Dashboard UID filter
	if opts.DashboardUID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("dashboard_uid = $%d", argNum))
		args = append(args, opts.DashboardUID)
		argNum++
	}

	// Panel ID filter
	if opts.PanelID != 0 {
		whereClauses = append(whereClauses, fmt.Sprintf("panel_id = $%d", argNum))
		args = append(args, opts.PanelID)
		argNum++
	}

	// Created by filter
	if opts.CreatedBy != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("created_by = $%d", argNum))
		args = append(args, opts.CreatedBy)
		argNum++
	}

	// Tags filter
	if len(opts.Tags) > 0 {
		if opts.TagsMatchAny {
			// ANY match: tags && $array (overlaps operator)
			whereClauses = append(whereClauses, fmt.Sprintf("tags && $%d", argNum))
		} else {
			// ALL match: tags @> $array (contains operator)
			whereClauses = append(whereClauses, fmt.Sprintf("tags @> $%d", argNum))
		}
		args = append(args, pq.Array(opts.Tags))
		argNum++
	}

	// Scopes filter
	if len(opts.Scopes) > 0 {
		if opts.ScopesMatchAny {
			// ANY match: scopes && $array (overlaps operator)
			whereClauses = append(whereClauses, fmt.Sprintf("scopes && $%d", argNum))
		} else {
			// ALL match: scopes @> $array (contains operator)
			whereClauses = append(whereClauses, fmt.Sprintf("scopes @> $%d", argNum))
		}
		args = append(args, pq.Array(opts.Scopes))
		argNum++
	}

	// Build the query
	queryLimit := opts.Limit + 1 // Query for one more to check if there are more results
	if queryLimit <= 0 {
		queryLimit = 101 // Default limit
	}

	query := fmt.Sprintf(`
		SELECT namespace, name, time, time_end, dashboard_uid, panel_id,
		       text, tags, scopes, created_by, created_at
		FROM annotations
		WHERE %s
		ORDER BY time DESC, name
		LIMIT $%d
		OFFSET $%d
	`, strings.Join(whereClauses, " AND "), argNum, argNum+1)

	args = append(args, queryLimit, offset)

	return query, args
}

// rowToAnnotation converts a database row to an Annotation object
func rowToAnnotation(
	namespace, name string,
	timeMs int64,
	timeEnd sql.NullInt64,
	dashUID sql.NullString,
	panelID sql.NullInt64,
	text string,
	tags, scopes pq.StringArray,
	createdBy sql.NullString,
	createdAt int64,
) *annotationV0.Annotation {
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: metav1.NewTime(time.UnixMilli(createdAt)),
		},
		Spec: annotationV0.AnnotationSpec{
			Text:   text,
			Time:   timeMs,
			Tags:   tags,
			Scopes: scopes,
		},
	}

	if timeEnd.Valid {
		anno.Spec.TimeEnd = &timeEnd.Int64
	}

	if dashUID.Valid && dashUID.String != "" {
		anno.Spec.DashboardUID = &dashUID.String
	}

	if panelID.Valid {
		anno.Spec.PanelID = &panelID.Int64
	}

	if createdBy.Valid && createdBy.String != "" {
		if m, err := utils.MetaAccessor(anno); err == nil {
			m.SetCreatedBy(createdBy.String)
		}
	}

	return anno
}
