package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationWithTransactionalDbSessionCommit(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store := InitTestDB(t)

	err := store.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		_, err := sess.Exec("CREATE TABLE IF NOT EXISTS test_with_tx_commit (id INTEGER PRIMARY KEY, name TEXT)")
		require.NoError(t, err)

		_, err = sess.Exec("INSERT INTO test_with_tx_commit (name) VALUES (?)", "test")
		require.NoError(t, err)

		var name string
		_, err = sess.SQL("SELECT name FROM test_with_tx_commit WHERE id = ?", 1).Get(&name)
		require.NoError(t, err)
		assert.Equal(t, "test", name)

		return nil
	})
	require.NoError(t, err)

	store.WithDbSession(context.Background(), func(sess *DBSession) error {
		var name string
		_, err = sess.SQL("SELECT name FROM test_with_tx_commit WHERE id = ?", 1).Get(&name)
		require.NoError(t, err)
		assert.Equal(t, "test", name)

		return nil
	})
}

func TestIntegrationWithTransactionalDbSessionRollback(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store := InitTestDB(t)

	err := store.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
		_, err := sess.Exec("CREATE TABLE IF NOT EXISTS test_with_tx_rollback (id INTEGER PRIMARY KEY, name TEXT)")
		require.NoError(t, err)

		_, err = sess.Exec("INSERT INTO test_with_tx_rollback (name) VALUES (?)", "test")
		require.NoError(t, err)

		var name string
		_, err = sess.SQL("SELECT name FROM test_with_tx_rollback WHERE id = ?", 1).Get(&name)
		require.NoError(t, err)
		assert.Equal(t, "test", name)

		return errors.New("rollback")
	})
	require.Error(t, err)

	store.WithDbSession(context.Background(), func(sess *DBSession) error {
		var name string
		_, err = sess.SQL("SELECT name FROM test_with_tx_rollback WHERE id = ?", 1).Get(&name)
		require.Error(t, err)
		assert.ErrorContains(t, err, "test_with_tx_rollback")
		return nil
	})
}

func TestIntegrationInTransactionCommit(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store := InitTestDB(t)

	err := store.InTransaction(context.Background(), func(ctx context.Context) error {
		store.WithDbSession(ctx, func(sess *DBSession) error {
			_, err := sess.Exec("CREATE TABLE IF NOT EXISTS test_in_tx_commit (id INTEGER PRIMARY KEY, name TEXT)")
			require.NoError(t, err)
			return nil
		})

		store.WithDbSession(ctx, func(sess *DBSession) error {
			_, err := sess.Exec("INSERT INTO test_in_tx_commit (name) VALUES (?)", "test")
			require.NoError(t, err)
			return nil
		})

		store.WithDbSession(ctx, func(sess *DBSession) error {
			var name string
			_, err := sess.SQL("SELECT name FROM test_in_tx_commit WHERE id = ?", 1).Get(&name)
			require.NoError(t, err)
			assert.Equal(t, "test", name)
			return nil
		})

		return nil
	})
	require.NoError(t, err)

	store.WithDbSession(context.Background(), func(sess *DBSession) error {
		var name string
		_, err = sess.SQL("SELECT name FROM test_in_tx_commit WHERE id = ?", 1).Get(&name)
		require.NoError(t, err)
		assert.Equal(t, "test", name)
		return nil
	})
}

func TestIntegrationInTransactionRollback(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store := InitTestDB(t)

	err := store.InTransaction(context.Background(), func(ctx context.Context) error {
		store.WithDbSession(ctx, func(sess *DBSession) error {
			_, err := sess.Exec("CREATE TABLE IF NOT EXISTS test_in_tx_rollback (id INTEGER PRIMARY KEY, name TEXT)")
			require.NoError(t, err)
			return nil
		})

		store.WithDbSession(ctx, func(sess *DBSession) error {
			_, err := sess.Exec("INSERT INTO test_in_tx_rollback (name) VALUES (?)", "test")
			require.NoError(t, err)
			return nil
		})

		store.WithDbSession(ctx, func(sess *DBSession) error {
			var name string
			_, err := sess.SQL("SELECT name FROM test_in_tx_rollback WHERE id = ?", 1).Get(&name)
			require.NoError(t, err)
			assert.Equal(t, "test", name)
			return nil
		})

		return errors.New("rollback")
	})
	require.Error(t, err)

	store.WithDbSession(context.Background(), func(sess *DBSession) error {
		var name string
		_, err = sess.SQL("SELECT name FROM test_in_tx_rollback WHERE id = ?", 1).Get(&name)
		require.Error(t, err)
		assert.ErrorContains(t, err, "test_in_tx_rollback")
		return nil
	})
}

func TestIntegrationReuseSessionWithTransaction(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := InitTestDB(t)

	t.Run("top level transaction", func(t *testing.T) {
		var outerSession *DBSession
		err := ss.InTransaction(context.Background(), func(ctx context.Context) error {
			value := ctx.Value(ContextSessionKey{})
			var ok bool
			outerSession, ok = value.(*DBSession)

			require.True(t, ok, "Session should be available in the context but it does not exist")
			require.True(t, outerSession.transactionOpen, "Transaction should be open")

			require.NoError(t, ss.WithDbSession(ctx, func(sess *DBSession) error {
				require.Equal(t, outerSession, sess)
				require.False(t, sess.IsClosed(), "Session is closed but it should not be")
				return nil
			}))

			require.NoError(t, ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
				require.Equal(t, outerSession, sess)
				require.False(t, sess.IsClosed(), "Session is closed but it should not be")
				return nil
			}))

			require.False(t, outerSession.IsClosed(), "Session is closed but it should not be")
			return nil
		})

		require.NoError(t, err)
		require.True(t, outerSession.IsClosed())
	})

	t.Run("fails if reuses session without transaction", func(t *testing.T) {
		require.NoError(t, ss.WithDbSession(context.Background(), func(outerSession *DBSession) error {
			require.NotNil(t, outerSession)
			require.NotNil(t, outerSession.DB()) // init the session
			require.False(t, outerSession.IsClosed(), "Session is closed but it should not be")

			ctx := context.WithValue(context.Background(), ContextSessionKey{}, outerSession)

			require.NoError(t, ss.WithDbSession(ctx, func(sess *DBSession) error {
				require.Equal(t, outerSession, sess)
				require.False(t, sess.IsClosed(), "Session is closed but it should not be")
				return nil
			}))

			require.Error(t, ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
				require.FailNow(t, "WithTransactionalDbSession should not be able to reuse session that did not open the transaction ")
				return nil
			}))
			return nil
		}))
	})
}

func TestIntegrationPublishAfterCommitWithNestedTransactions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := InitTestDB(t)
	ctx := context.Background()

	// On X success
	var xHasSucceeded bool
	ss.Bus().AddEventListener(func(ctx context.Context, e *X) error {
		xHasSucceeded = true
		t.Logf("Succeeded and committed: %T\n", e)
		return nil
	})

	// On Y success
	var yHasSucceeded bool
	ss.Bus().AddEventListener(func(ctx context.Context, e *Y) error {
		yHasSucceeded = true
		t.Logf("Succeeded and committed: %T\n", e)
		return nil
	})

	t.Run("When no session is stored into the context, each transaction should be independent", func(t *testing.T) {
		t.Cleanup(func() { xHasSucceeded = false; yHasSucceeded = false })

		err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
			t.Logf("Outer transaction: doing X... success!")
			sess.PublishAfterCommit(&X{})

			require.NoError(t, ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
				t.Log("Inner transaction: doing Y... success!")
				sess.PublishAfterCommit(&Y{})
				return nil
			}))

			t.Log("Outer transaction: doing Z... failure, rolling back...")
			return errors.New("z failed")
		})

		assert.NotNil(t, err)
		assert.False(t, xHasSucceeded)
		assert.True(t, yHasSucceeded)
	})

	t.Run("When the session is stored into the context, the inner transaction should depend on the outer one", func(t *testing.T) {
		t.Cleanup(func() { xHasSucceeded = false; yHasSucceeded = false })

		err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
			t.Logf("Outer transaction: doing X... success!")
			sess.PublishAfterCommit(&X{})

			require.NoError(t, ss.InTransaction(ctx, func(ctx context.Context) error {
				t.Log("Inner transaction: doing Y... success!")
				sess.PublishAfterCommit(&Y{})
				return nil
			}))

			t.Log("Outer transaction: doing Z... failure, rolling back...")
			return errors.New("z failed")
		})

		assert.NotNil(t, err)
		assert.False(t, xHasSucceeded)
		assert.False(t, yHasSucceeded)
	})
}

type X struct{}
type Y struct{}
