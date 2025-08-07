package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationReuseSessionWithTransaction(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := NewTestStore(t)

	t.Run("top level transaction", func(t *testing.T) {
		var outerSession *DBSession
		err := ss.InTransaction(t.Context(), func(ctx context.Context) error {
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
		require.NoError(t, ss.WithDbSession(t.Context(), func(outerSession *DBSession) error {
			require.NotNil(t, outerSession)
			require.NotNil(t, outerSession.DB()) // init the session
			require.False(t, outerSession.IsClosed(), "Session is closed but it should not be")

			ctx := context.WithValue(t.Context(), ContextSessionKey{}, outerSession)

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

	ss := NewTestStore(t)
	ctx := t.Context()

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
