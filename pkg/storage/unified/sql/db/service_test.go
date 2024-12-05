package db_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/mocks"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var errTest = errors.New("you shall not pass")

// Copy-paste of the constants used in `service.go`, since we need to use a
// separate package to avoid circular dependencies so we cannot import them.
// Keep these ones and the ones in `service.go` in sync.
const (
	txOpStr     = "transactional operation"
	beginStr    = "begin"
	commitStr   = "commit"
	rollbackStr = "rollback"
)

func TestNewWithTxFunc(t *testing.T) {
	t.Parallel()

	execTest := func(t *testing.T, d db.DB, txErr error) error {
		ctx := testutil.NewDefaultTestContext(t)
		return db.NewWithTxFunc(d.BeginTx).WithTx(ctx, nil,
			func(context.Context, db.Tx) error {
				return txErr
			})
	}

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()
		mDB, mTx := mocks.NewDB(t), mocks.NewTx(t)

		mDB.EXPECT().BeginTx(mock.Anything, mock.Anything).Return(mTx, nil)
		mTx.EXPECT().Commit().Return(nil)

		err := execTest(t, mDB, nil)
		require.NoError(t, err)
	})

	t.Run("failed begin", func(t *testing.T) {
		t.Parallel()
		mDB := mocks.NewDB(t)

		mDB.EXPECT().BeginTx(mock.Anything, mock.Anything).Return(nil, errTest)

		err := execTest(t, mDB, nil)
		require.Error(t, err)
		require.ErrorContains(t, err, beginStr)
	})

	t.Run("fail tx", func(t *testing.T) {
		t.Parallel()
		mDB, mTx := mocks.NewDB(t), mocks.NewTx(t)

		mDB.EXPECT().BeginTx(mock.Anything, mock.Anything).Return(mTx, nil)
		mTx.EXPECT().Rollback().Return(nil)

		err := execTest(t, mDB, errTest)
		require.Error(t, err)
		require.ErrorContains(t, err, txOpStr)
	})

	t.Run("fail tx; fail rollback", func(t *testing.T) {
		t.Parallel()
		mDB, mTx := mocks.NewDB(t), mocks.NewTx(t)

		mDB.EXPECT().BeginTx(mock.Anything, mock.Anything).Return(mTx, nil)
		mTx.EXPECT().Rollback().Return(errTest)

		err := execTest(t, mDB, errTest)
		require.Error(t, err)
		require.ErrorContains(t, err, txOpStr)
		require.ErrorContains(t, err, rollbackStr)
	})

	t.Run("fail commit", func(t *testing.T) {
		t.Parallel()
		mDB, mTx := mocks.NewDB(t), mocks.NewTx(t)

		mDB.EXPECT().BeginTx(mock.Anything, mock.Anything).Return(mTx, nil)
		mTx.EXPECT().Commit().Return(errTest)

		err := execTest(t, mDB, nil)
		require.Error(t, err)
		require.ErrorContains(t, err, commitStr)
	})
}
