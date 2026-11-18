package sqlstore

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"testing/synctest"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/stretchr/testify/require"
)

func helperTestEngine(t *testing.T) (*xorm.Engine, sqlmock.Sqlmock) {
	t.Helper()
	engine, err := xorm.NewEngine("sqlite3", ":memory:")
	require.NoError(t, err)
	originalDB := engine.DB().DB
	t.Cleanup(func() { require.NoError(t, originalDB.Close()) })
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	engine.DB().DB = db
	t.Cleanup(func() { _ = engine.Close() })
	return engine, mock
}

func TestWithEngineTransactionCommitsAndPublishesQueuedEvents(t *testing.T) {
	engine, mock := helperTestEngine(t)
	mock.ExpectBegin()
	mock.ExpectCommit()

	tracer := tracing.NewNoopTracerService()
	var published []any
	events := &recordingBus{publish: func(_ context.Context, event any) error {
		published = append(published, event)
		return nil
	}}
	err := WithEngineTransaction(context.Background(), engine, events, tracer, func(sess *DBSession) error {
		sess.PublishAfterCommit("done")
		require.Empty(t, published)
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, []any{"done"}, published)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionReusesNestedSessionAndPublishesOnce(t *testing.T) {
	engine, mock := helperTestEngine(t)
	mock.ExpectBegin()
	mock.ExpectCommit()
	tracer := tracing.NewNoopTracerService()
	var published []any
	events := &recordingBus{publish: func(_ context.Context, event any) error {
		published = append(published, event)
		return nil
	}}
	err := WithEngineTransaction(context.Background(), engine, events, tracer, func(outer *DBSession) error {
		ctx := context.WithValue(context.Background(), ContextSessionKey{}, outer)
		outer.PublishAfterCommit("outer")
		return WithEngineTransaction(ctx, engine, events, tracer, func(inner *DBSession) error {
			require.Same(t, outer, inner)
			inner.PublishAfterCommit("inner")
			require.Empty(t, published)
			return WithEngineSession(ctx, engine, tracer, func(reused *DBSession) error {
				require.Same(t, outer, reused)
				return nil
			})
		})
	})
	require.NoError(t, err)
	require.Equal(t, []any{"outer", "inner"}, published)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionRollsBackWithoutPublishing(t *testing.T) {
	engine, mock := helperTestEngine(t)
	mock.ExpectBegin()
	mock.ExpectRollback()
	callbackErr := errors.New("callback failed")
	published := false
	events := &recordingBus{publish: func(context.Context, any) error {
		published = true
		return nil
	}}
	err := WithEngineTransaction(context.Background(), engine, events, tracing.NewNoopTracerService(), func(sess *DBSession) error {
		sess.PublishAfterCommit("discard")
		return callbackErr
	})
	require.ErrorIs(t, err, callbackErr)
	require.False(t, published)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionCommitErrorKeepsEventsQueued(t *testing.T) {
	engine, mock := helperTestEngine(t)
	mock.ExpectBegin()
	commitErr := errors.New("commit outcome unknown")
	mock.ExpectCommit().WillReturnError(commitErr)
	published := false
	events := &recordingBus{publish: func(context.Context, any) error {
		published = true
		return nil
	}}
	err := WithEngineTransaction(context.Background(), engine, events, tracing.NewNoopTracerService(), func(sess *DBSession) error {
		sess.PublishAfterCommit("discard")
		return nil
	})
	require.ErrorIs(t, err, commitErr)
	require.False(t, published)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionRejectsCanceledBeginBeforeCallback(t *testing.T) {
	engine, mock := helperTestEngine(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	called := false
	err := WithEngineTransaction(ctx, engine, &recordingBus{}, tracing.NewNoopTracerService(), func(*DBSession) error {
		called = true
		return nil
	})
	require.ErrorIs(t, err, context.Canceled)
	require.False(t, called)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestExistingSQLStoreTransactionsCommitAfterRequestCancellation(t *testing.T) {
	for _, tc := range []struct {
		name string
		run  func(*SQLStore, context.Context, DBTransactionFunc) error
	}{
		{
			name: "WithTransactionalDbSession",
			run: func(store *SQLStore, ctx context.Context, callback DBTransactionFunc) error {
				return store.WithTransactionalDbSession(ctx, callback)
			},
		},
		{
			name: "InTransaction",
			run: func(store *SQLStore, ctx context.Context, callback DBTransactionFunc) error {
				return store.InTransaction(ctx, func(ctx context.Context) error {
					return store.WithDbSession(ctx, callback)
				})
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			engine, mock := helperTestEngine(t)
			mock.ExpectBegin()
			mock.ExpectExec("INSERT INTO records").WillReturnResult(sqlmock.NewResult(1, 1))
			mock.ExpectCommit()
			store := &SQLStore{engine: engine, dbCfg: &DatabaseConfig{}, tracer: tracing.NewNoopTracerService()}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			err := tc.run(store, ctx, func(sess *DBSession) error {
				if _, err := sess.Exec("INSERT INTO records (id) VALUES (1)"); err != nil {
					return err
				}
				cancel()
				return nil
			})
			require.NoError(t, err)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestWithEngineTransactionDoesNotPublishAfterRequestCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		engine, mock := helperTestEngine(t)
		mock.ExpectBegin()
		mock.ExpectExec("INSERT INTO records").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectRollback()
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		published := false
		events := &recordingBus{publish: func(context.Context, any) error {
			published = true
			return nil
		}}

		err := WithEngineTransaction(ctx, engine, events, tracing.NewNoopTracerService(), func(sess *DBSession) error {
			if _, err := sess.Exec("INSERT INTO records (id) VALUES (1)"); err != nil {
				return err
			}
			sess.PublishAfterCommit("discard")
			cancel()
			return nil
		})
		synctest.Wait()
		require.True(t, errors.Is(err, context.Canceled) || errors.Is(err, sql.ErrTxDone), "expected canceled transaction, got %v", err)
		require.False(t, published)
		require.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestWithEngineTransactionRejectsCrossEngineSession(t *testing.T) {
	engine, mock := helperTestEngine(t)
	other, otherMock := helperTestEngine(t)
	mock.ExpectBegin()
	mock.ExpectRollback()
	tracer := tracing.NewNoopTracerService()
	called := false
	err := WithEngineTransaction(context.Background(), engine, &recordingBus{}, tracer, func(sess *DBSession) error {
		ctx := context.WithValue(context.Background(), ContextSessionKey{}, sess)
		return WithEngineTransaction(ctx, other, &recordingBus{}, tracer, func(*DBSession) error {
			called = true
			return nil
		})
	})
	require.ErrorContains(t, err, "another engine")
	require.False(t, called)
	require.NoError(t, mock.ExpectationsWereMet())
	require.NoError(t, otherMock.ExpectationsWereMet())
}

func TestWithEngineTransactionPublisherErrorDoesNotChangeCommittedResult(t *testing.T) {
	engine, mock := helperTestEngine(t)
	mock.ExpectBegin()
	mock.ExpectCommit()
	published := 0
	events := &recordingBus{publish: func(context.Context, any) error {
		published++
		return errors.New("listener failed")
	}}
	err := WithEngineTransaction(context.Background(), engine, events, tracing.NewNoopTracerService(), func(sess *DBSession) error {
		sess.PublishAfterCommit("committed")
		return nil
	})
	require.NoError(t, err)
	require.Equal(t, 1, published)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineSessionCallsCallbackOnceWithoutBeginningTransaction(t *testing.T) {
	engine, mock := helperTestEngine(t)
	called := 0
	callbackErr := errors.New("callback failed")
	err := WithEngineSession(context.Background(), engine, tracing.NewNoopTracerService(), func(sess *DBSession) error {
		called++
		require.NotNil(t, sess)
		return callbackErr
	})
	require.ErrorIs(t, err, callbackErr)
	require.Equal(t, 1, called)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionBeginFailureDoesNotCallCallback(t *testing.T) {
	engine, mock := helperTestEngine(t)
	beginErr := errors.New("begin failed")
	mock.ExpectBegin().WillReturnError(beginErr)
	called := false
	err := WithEngineTransaction(context.Background(), engine, &recordingBus{}, tracing.NewNoopTracerService(), func(*DBSession) error {
		called = true
		return nil
	})
	require.ErrorIs(t, err, beginErr)
	require.False(t, called)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionRejectsClosedContextSession(t *testing.T) {
	engine, mock := helperTestEngine(t)
	mock.ExpectBegin()
	mock.ExpectCommit()
	tracer := tracing.NewNoopTracerService()
	var captured *DBSession
	require.NoError(t, WithEngineTransaction(context.Background(), engine, &recordingBus{}, tracer, func(sess *DBSession) error {
		captured = sess
		return nil
	}))
	called := false
	ctx := context.WithValue(context.Background(), ContextSessionKey{}, captured)
	err := WithEngineTransaction(ctx, engine, &recordingBus{}, tracer, func(*DBSession) error {
		called = true
		return nil
	})
	require.ErrorContains(t, err, "closed or invalid")
	require.False(t, called)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestWithEngineTransactionRejectsTypedNilContextSession(t *testing.T) {
	engine, mock := helperTestEngine(t)
	ctx := context.WithValue(context.Background(), ContextSessionKey{}, (*DBSession)(nil))
	called := false
	err := WithEngineTransaction(ctx, engine, &recordingBus{}, tracing.NewNoopTracerService(), func(*DBSession) error {
		called = true
		return nil
	})
	require.ErrorContains(t, err, "invalid")
	require.False(t, called)
	require.NoError(t, mock.ExpectationsWereMet())
}

type recordingBus struct {
	publish func(context.Context, any) error
}

func (b *recordingBus) Publish(ctx context.Context, event bus.Msg) error {
	return b.publish(ctx, event)
}
func (b *recordingBus) AddEventListener(bus.HandlerFunc) {}
