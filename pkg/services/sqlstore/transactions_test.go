package sqlstore

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTxnRetryBackoff(t *testing.T) {
	// The cap on the exponential ramp; once we hit it the delay should stay at
	// the max regardless of how high retry climbs.
	for _, retry := range []int{0, 1, 2, 4, 5, 10, 62, 63, 100, 1000} {
		for range 100 {
			d := txnRetryBackoff(retry)
			require.GreaterOrEqual(t, d, time.Duration(0))
			require.Less(t, d, txnRetryMaxDelay)
		}
	}
}

func TestRunAfterCommitWithoutTransaction(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	called := false
	RunAfterCommit(ctx, "refresh", func(ctx context.Context) {
		called = true
		require.ErrorIs(t, ctx.Err(), context.Canceled)
		require.Nil(t, ctx.Value(ContextSessionKey{}))
	})
	require.True(t, called)
}

func TestIntegrationRunAfterCommit(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ss := NewTestStore(t)
	rollback := errors.New("rollback")
	type contextKey struct{}
	for _, transactionErr := range []error{nil, rollback} {
		name := "commit"
		if transactionErr != nil {
			name = "rollback"
		}
		t.Run(name, func(t *testing.T) {
			var calls []string
			ctx := context.WithValue(t.Context(), contextKey{}, "request metadata")
			err := ss.InTransaction(ctx, func(ctx context.Context) error {
				RunAfterCommit(ctx, "refresh", func(context.Context) { t.Error("superseded callback ran") })
				require.NoError(t, ss.InTransaction(ctx, func(ctx context.Context) error {
					RunAfterCommit(ctx, "refresh", func(ctx context.Context) {
						require.Nil(t, ctx.Value(ContextSessionKey{}))
						require.Equal(t, "request metadata", ctx.Value(contextKey{}))
						require.NoError(t, ss.WithDbSession(ctx, func(sess *DBSession) error {
							require.False(t, sess.transactionOpen)
							return nil
						}))
						calls = append(calls, "refresh")
					})
					return nil
				}))
				RunAfterCommit(ctx, "another", func(context.Context) { calls = append(calls, "another") })
				require.Empty(t, calls)
				return transactionErr
			})
			require.ErrorIs(t, err, transactionErr)
			if transactionErr == nil {
				require.Equal(t, []string{"refresh", "another"}, calls)
			} else {
				require.Empty(t, calls)
			}
		})
	}
}

func TestIntegrationReuseSessionWithTransaction(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss, _ := InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore

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
	testutil.SkipIntegrationTestInShortMode(t)

	ss, _ := InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
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
