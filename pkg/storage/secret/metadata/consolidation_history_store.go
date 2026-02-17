package metadata

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/metrics"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// consolidationHistoryStore is the actual implementation of the consolidation history store.
type consolidationHistoryStore struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
	metrics *metrics.StorageMetrics
}

var _ contracts.ConsolidationHistoryStorage = (*consolidationHistoryStore)(nil)

func ProvideConsolidationHistoryStore(
	db contracts.Database,
	tracer trace.Tracer,
	reg prometheus.Registerer,
) (contracts.ConsolidationHistoryStorage, error) {
	return &consolidationHistoryStore{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
		metrics: metrics.NewStorageMetrics(reg),
	}, nil
}

func (s *consolidationHistoryStore) StartNewConsolidation(ctx context.Context) (createErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "ConsolidationHistoryStore.StartNewConsolidation")
	defer span.End()

	defer func() {
		success := createErr == nil
		args := []any{"success", success}
		if !success {
			span.SetStatus(codes.Error, "ConsolidationHistoryStore.StartNewConsolidation failed")
			span.RecordError(createErr)
			args = append(args, "error", createErr)
		}
		logging.FromContext(ctx).Info("ConsolidationHistoryStore.StartNewConsolidation", args...)
		s.metrics.ConsolidationHistoryStartDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	now := time.Now().UTC().Unix()
	req := createConsolidationHistory{
		SQLTemplate: sqltemplate.New(s.dialect),
		Created:     now,
		Completed:   0, // empty = not yet completed
	}
	query, err := sqltemplate.Execute(sqlConsolidationHistoryCreate, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlConsolidationHistoryCreate.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("inserting consolidation row: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}
	return nil
}

func (s *consolidationHistoryStore) FinishCurrentConsolidation(ctx context.Context) (finishErr error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "ConsolidationHistoryStore.FinishCurrentConsolidation")
	defer span.End()

	defer func() {
		success := finishErr == nil
		args := []any{"success", success}
		if !success {
			span.SetStatus(codes.Error, "ConsolidationHistoryStore.FinishCurrentConsolidation failed")
			span.RecordError(finishErr)
			args = append(args, "error", finishErr)
		}
		logging.FromContext(ctx).Info("ConsolidationHistoryStore.FinishCurrentConsolidation", args...)
		s.metrics.ConsolidationHistoryFinishDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	err := s.db.Transaction(ctx, func(ctx context.Context) error {
		// Lock the latest unfinished row in this transaction so nothing can change between select and update.
		reqSelect := getLatestUnfinishedConsolidationHistory{
			SQLTemplate: sqltemplate.New(s.dialect),
			IsForUpdate: true,
		}
		querySelect, err := sqltemplate.Execute(sqlConsolidationHistoryGetLatestUnfinished, reqSelect)
		if err != nil {
			return fmt.Errorf("execute template %q: %w", sqlConsolidationHistoryGetLatestUnfinished.Name(), err)
		}
		rows, err := s.db.QueryContext(ctx, querySelect, reqSelect.GetArgs()...)
		if err != nil {
			return fmt.Errorf("querying latest unfinished consolidation: %w", err)
		}
		defer func() { _ = rows.Close() }()

		if !rows.Next() {
			return contracts.ErrNoConsolidationToFinish
		}
		var id int64
		var created, completed int64
		if err := rows.Scan(&id, &created, &completed); err != nil {
			return fmt.Errorf("scanning consolidation row: %w", err)
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("read rows error: %w", err)
		}
		if completed != 0 {
			return contracts.ErrNoConsolidationToFinish
		}

		now := time.Now().UTC().Unix()
		reqUpdate := finishConsolidationHistory{
			SQLTemplate: sqltemplate.New(s.dialect),
			ID:          id,
			Completed:   now,
		}
		queryUpdate, err := sqltemplate.Execute(sqlConsolidationHistoryFinish, reqUpdate)
		if err != nil {
			return fmt.Errorf("execute template %q: %w", sqlConsolidationHistoryFinish.Name(), err)
		}
		result, err := s.db.ExecContext(ctx, queryUpdate, reqUpdate.GetArgs()...)
		if err != nil {
			return fmt.Errorf("updating consolidation completed: %w", err)
		}
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}
		if rowsAffected != 1 {
			return contracts.ErrNoConsolidationToFinish
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *consolidationHistoryStore) GetLatestConsolidation(ctx context.Context) (record *contracts.ConsolidationRecord, err error) {
	start := time.Now()
	ctx, span := s.tracer.Start(ctx, "ConsolidationHistoryStore.GetLatestConsolidation")
	defer span.End()

	defer func() {
		success := err == nil
		args := []any{"success", success}
		if !success {
			span.SetStatus(codes.Error, "ConsolidationHistoryStore.GetLatestConsolidation failed")
			span.RecordError(err)
			args = append(args, "error", err)
		}
		logging.FromContext(ctx).Info("ConsolidationHistoryStore.GetLatestConsolidation", args...)
		s.metrics.ConsolidationHistoryGetDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
	}()

	req := getLatestConsolidationHistory{
		SQLTemplate: sqltemplate.New(s.dialect),
	}
	query, err := sqltemplate.Execute(sqlConsolidationHistoryGetLatest, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlConsolidationHistoryGetLatest.Name(), err)
	}
	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("querying latest consolidation: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, nil
	}
	var id int64
	var created, completed int64
	if err := rows.Scan(&id, &created, &completed); err != nil {
		return nil, fmt.Errorf("scanning consolidation row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	rec := &contracts.ConsolidationRecord{
		ID:      id,
		Created: time.Unix(created, 0).UTC(),
	}
	if completed != 0 {
		rec.Completed = time.Unix(completed, 0).UTC()
	}
	return rec, nil
}
