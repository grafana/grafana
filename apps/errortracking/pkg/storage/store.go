// Package storage implements app-owned PostgreSQL storage for error-tracking events.
package storage

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	errortrackingapp "github.com/grafana/grafana/apps/errortracking/pkg/app"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel/trace"
)

var _ errortrackingapp.Store = (*Store)(nil)

type Store struct {
	pool     *pgxpool.Pool
	disabled bool
}

const DefaultMaxConns int32 = 4

func NewDisabledStore() *Store { return &Store{disabled: true} }

// NewStore creates the app-owned PostgreSQL store for a standalone app
// installer. The caller owns the returned pool and must call Close.
func NewStore(connectionString string, maxConns int32) (*Store, error) {
	if maxConns < 1 {
		return nil, fmt.Errorf("error tracking database max_conns must be positive")
	}
	poolConfig, err := pgxpool.ParseConfig(connectionString)
	if err != nil {
		return nil, fmt.Errorf("parse error tracking database configuration")
	}
	poolConfig.MaxConns = maxConns
	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, databaseFailure(context.Background(), "create pool", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, databaseFailure(ctx, "ping", err)
	}
	if err := verifySchema(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func verifySchema(ctx context.Context, pool *pgxpool.Pool) error {
	var columnCount int
	if err := pool.QueryRow(ctx, `
		SELECT count(*)
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND table_name = 'error_tracking_event'
		AND column_name = ANY($1::text[])`, []string{
		"id", "created_at", "occurred_at", "tenant_namespace", "project",
		"message", "created_by", "source_ip",
	}).Scan(&columnCount); err != nil {
		return databaseFailure(ctx, "check schema", err)
	}
	if columnCount != 8 {
		return fmt.Errorf("error tracking schema is missing or incomplete; run error-tracking migrate")
	}
	if err := requireCurrentMigration(ctx, pool); err != nil {
		return err
	}
	return nil
}

// Close releases the app-owned pool when the owning process shuts down.
func (s *Store) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// ReadinessCheck is used by the API server's storage readiness hook. Liveness remains
// process-only; a database outage should remove this app from service without restarting Grafana.
func (s *Store) ReadinessCheck() error {
	if s.disabled {
		return nil
	}
	if s.pool == nil {
		return fmt.Errorf("error tracking database is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return requireCurrentMigration(ctx, s.pool)
}

func (s *Store) checkAvailable() error {
	if s.disabled {
		return fmt.Errorf("error tracking API is disabled")
	}
	if s.pool == nil {
		return fmt.Errorf("error tracking database is not configured")
	}
	return nil
}

func (s *Store) InsertEvent(ctx context.Context, tenant, createdBy, sourceIP, project, message string, occurredAt int64) error {
	if err := s.checkAvailable(); err != nil {
		return err
	}
	if occurredAt == 0 {
		occurredAt = time.Now().UnixMilli()
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO error_tracking_event
		(created_at, occurred_at, tenant_namespace, project, message, created_by, source_ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`, time.Now().UnixMilli(), occurredAt, tenant, project, message, createdBy, sourceIP)
	if err != nil {
		return databaseFailure(ctx, "insert event", err)
	}
	return nil
}

func (s *Store) ListEvents(ctx context.Context, tenant string, from, to time.Time, limit int) ([]errortrackingapp.Event, error) {
	if err := s.checkAvailable(); err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, `SELECT occurred_at, project, message, created_by
		FROM error_tracking_event WHERE tenant_namespace = $1 AND occurred_at >= $2 AND occurred_at <= $3
		ORDER BY occurred_at DESC LIMIT $4`, tenant, from.UnixMilli(), to.UnixMilli(), limit)
	if err != nil {
		return nil, databaseFailure(ctx, "list events", err)
	}
	defer rows.Close()
	events := make([]errortrackingapp.Event, 0)
	for rows.Next() {
		var event errortrackingapp.Event
		if err := rows.Scan(&event.OccurredAt, &event.Project, &event.Message, &event.CreatedBy); err != nil {
			return nil, databaseFailure(ctx, "scan events", err)
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, databaseFailure(ctx, "list events", err)
	}
	return events, nil
}

func databaseFailure(ctx context.Context, operation string, err error) error {
	errorClass := "database"
	errorCode := ""
	switch {
	case errors.Is(err, context.Canceled):
		errorClass = "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		errorClass = "deadline_exceeded"
	default:
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			errorClass = "postgres"
			errorCode = pgErr.Code
		}
	}
	safeError := fmt.Errorf("error tracking database %s failed", operation)
	slog.ErrorContext(ctx, "error tracking database operation failed", "operation", operation, "error_class", errorClass, "error_code", errorCode)
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.RecordError(safeError)
	}
	return safeError
}
