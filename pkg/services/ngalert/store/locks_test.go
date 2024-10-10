package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

func TestIntegrationWithLock(t *testing.T) {
	_, dbstore := tests.SetupTestEnv(t, 10)

	if db.IsTestDbSQLite() {
		t.Skip("skipping test for sqlite")
	}

	t.Run("second transaction should fail to acquire the same lock", func(t *testing.T) {
		ctx := context.Background()
		defer ctx.Done()

		lockName := "test-lock"

		// Acquire the lock in a goroutine
		go func() {
			err := dbstore.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
				lockErr := dbstore.WithLock(ctx, lockName, func(ctx context.Context) error {
					<-ctx.Done()
					return nil
				})
				require.NoError(t, lockErr, "expected no error from WithLock")
				return nil
			})
			require.NoError(t, err)
		}()

		// Wait for the lock to be acquired
		time.Sleep(100 * time.Millisecond)

		// Try to acquire the lock for the second time in a separate transaction, this should fail
		err := dbstore.SQLStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			lockErr := dbstore.WithLock(context.Background(), lockName, func(ctx context.Context) error {
				return nil
			})
			require.Error(t, lockErr, "expected error from WithLock due to lock acquisition failure")
			return nil
		})
		require.NoError(t, err)
	})
}
