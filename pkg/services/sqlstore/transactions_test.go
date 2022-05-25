//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

var ErrProvokedError = errors.New("testing error")

func TestIntegrationTransaction(t *testing.T) {
	ss := InitTestDB(t)

	cmd := &models.AddApiKeyCommand{Key: "secret-key", Name: "key", OrgId: 1}
	t.Run("can update key", func(t *testing.T) {
		err := ss.AddAPIKey(context.Background(), cmd)
		require.Nil(t, err)

		err = ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
			return deleteAPIKey(sess, cmd.Result.Id, 1)
		})

		require.Nil(t, err)

		query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
		err = ss.GetApiKeyById(context.Background(), query)
		require.Equal(t, models.ErrInvalidApiKey, err)
	})

	t.Run("won't update if one handler fails", func(t *testing.T) {
		err := ss.AddAPIKey(context.Background(), cmd)
		require.Nil(t, err)

		err = ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
			err := deleteAPIKey(sess, cmd.Result.Id, 1)
			if err != nil {
				return err
			}

			return ErrProvokedError
		})

		require.Equal(t, ErrProvokedError, err)

		query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
		err = ss.GetApiKeyById(context.Background(), query)
		require.Nil(t, err)
		require.Equal(t, cmd.Result.Id, query.Result.Id)
	})
}

func TestIntegrationReuseSessionWithTransaction(t *testing.T) {
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
