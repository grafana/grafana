package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
		fmt.Printf("Succeeded and committed: %T\n", e)
		return nil
	})

	// On Y success
	var yHasSucceeded bool
	ss.Bus().AddEventListener(func(ctx context.Context, e *Y) error {
		yHasSucceeded = true
		fmt.Printf("Succeeded and committed: %T\n", e)
		return nil
	})

	err := ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		fmt.Println("Outer transaction: doing X... success!")
		sess.PublishAfterCommit(&X{})

		ss.InTransaction(ctx, func(ctx context.Context) error {
			fmt.Println("Inner transaction: doing Y... success!")
			sess.PublishAfterCommit(&Y{})
			return nil
		})

		fmt.Println("Outer transaction: doing Z... failure, rolling back...")
		return errors.New("z failed")
	})

	assert.NotNil(t, err)
	assert.False(t, xHasSucceeded)
	assert.False(t, yHasSucceeded)
}

type X struct{}
type Y struct{}
