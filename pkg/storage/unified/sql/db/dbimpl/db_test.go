package dbimpl

import (
	"context"
	"errors"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

func newCtx(t *testing.T) context.Context {
	t.Helper()

	d, ok := t.Deadline()
	if !ok {
		// provide a default timeout for tests
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		t.Cleanup(cancel)

		return ctx
	}

	ctx, cancel := context.WithDeadline(context.Background(), d)
	t.Cleanup(cancel)

	return ctx
}

var errTest = errors.New("because of reasons")

const driverName = "sqlmock"

func TestDB_BeginTx(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, driverName)
		require.Equal(t, driverName, db.DriverName())

		mock.ExpectBegin()
		tx, err := db.BeginTx(newCtx(t), nil)

		require.NoError(t, err)
		require.NotNil(t, tx)
	})

	t.Run("fail begin", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, "sqlmock")

		mock.ExpectBegin().WillReturnError(errTest)
		tx, err := db.BeginTx(newCtx(t), nil)

		require.Nil(t, tx)
		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})
}

func TestDB_WithTx(t *testing.T) {
	t.Parallel()

	newTxFunc := func(err error) db.TxFunc {
		return func(context.Context, db.Tx) error {
			return err
		}
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, "sqlmock")

		mock.ExpectBegin()
		mock.ExpectCommit()
		err = db.WithTx(newCtx(t), nil, newTxFunc(nil))

		require.NoError(t, err)
	})

	t.Run("fail begin", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, "sqlmock")

		mock.ExpectBegin().WillReturnError(errTest)
		err = db.WithTx(newCtx(t), nil, newTxFunc(nil))

		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})

	t.Run("fail tx", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, "sqlmock")

		mock.ExpectBegin()
		mock.ExpectRollback()
		err = db.WithTx(newCtx(t), nil, newTxFunc(errTest))

		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})

	t.Run("fail tx; fail rollback", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, "sqlmock")
		errTest2 := errors.New("yet another err")

		mock.ExpectBegin()
		mock.ExpectRollback().WillReturnError(errTest)
		err = db.WithTx(newCtx(t), nil, newTxFunc(errTest2))

		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
		require.ErrorIs(t, err, errTest2)
	})

	t.Run("fail commit", func(t *testing.T) {
		t.Parallel()

		sqldb, mock, err := sqlmock.New()
		require.NoError(t, err)
		db := NewDB(sqldb, "sqlmock")

		mock.ExpectBegin()
		mock.ExpectCommit().WillReturnError(errTest)
		err = db.WithTx(newCtx(t), nil, newTxFunc(nil))

		require.Error(t, err)
		require.ErrorIs(t, err, errTest)
	})
}
