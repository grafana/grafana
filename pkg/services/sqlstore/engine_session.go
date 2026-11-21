package sqlstore

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// WithEngineSession lets database-provider implementations use their own engine.
// It closes a newly created session; a session carried by ctx is reused without
// taking ownership of it. Normal service code should use db.DB.WithDbSession.
func WithEngineSession(ctx context.Context, engine *xorm.Engine, tracer tracing.Tracer, callback DBTransactionFunc) error {
	if err := validateHelperSession(ctx, engine); err != nil {
		return err
	}
	sess, isNew, span, err := startSessionOrUseExisting(ctx, engine, false, tracer)
	defer span.End()
	if err != nil {
		return fmt.Errorf("start database session: %w", err)
	}
	if isNew {
		defer sess.Close()
		// xorm treats an unused session as closed until its DB wrapper is initialized.
		sess.DB()
	}
	return callback(sess)
}

// WithEngineTransaction lets database-provider implementations use their own engine.
// Nested calls reuse the context session; only the owner commits, rolls back,
// and publishes events. Normal service code should use db.DB.InTransaction.
func WithEngineTransaction(ctx context.Context, engine *xorm.Engine, events bus.Bus, tracer tracing.Tracer, callback DBTransactionFunc) error {
	if err := validateHelperSession(ctx, engine); err != nil {
		return err
	}
	sess, isNew, span, err := startSessionOrUseExisting(ctx, engine, false, tracer)
	defer span.End()
	if err != nil {
		return fmt.Errorf("start database transaction: %w", err)
	}
	span.SetAttributes(attribute.Bool("transaction", true))
	if isNew {
		defer sess.Close()
		if err := sess.Begin(); err != nil {
			return fmt.Errorf("start database transaction: %w", err)
		}
		sess.transactionOpen = true
	} else if !sess.transactionOpen {
		return fmt.Errorf("cannot reuse session without an open transaction")
	}

	callbackErr := callback(sess)
	if !isNew {
		return callbackErr
	}
	if callbackErr != nil {
		if rollErr := sess.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, callbackErr)
		}
		return callbackErr
	}
	if err := sess.Commit(); err != nil {
		return err
	}
	for _, event := range sess.events {
		if err := events.Publish(ctx, event); err != nil {
			tsclogger.FromContext(ctx).Error("Failed to publish event after commit.", "error", err)
		}
	}
	return nil
}

// validateHelperSession prevents nested helpers from reusing invalid sessions or sessions from another database pool.
func validateHelperSession(ctx context.Context, engine *xorm.Engine) error {
	if engine == nil {
		return fmt.Errorf("database engine is nil")
	}
	if value := ctx.Value(ContextSessionKey{}); value != nil {
		sess, ok := value.(*DBSession)
		if !ok || sess == nil {
			return fmt.Errorf("context database session is invalid")
		}
		if sess.Session == nil || sess.IsClosed() {
			return fmt.Errorf("context database session is closed or invalid")
		}
		if sess.DB() != engine.DB() {
			return fmt.Errorf("context database session belongs to another engine")
		}
	}
	return nil
}
