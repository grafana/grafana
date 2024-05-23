package dbimpl

import (
	"context"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	entitydb "github.com/grafana/grafana/pkg/services/store/entity/db"
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

func TestDB_WithTx(t *testing.T) {
	t.Parallel()

	newTxFunc := func(err error) entitydb.TxFunc {
		return func(context.Context, entitydb.Tx) error {
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
}
