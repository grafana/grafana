// +build integration

package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/models"
)

var ErrProvokedError = errors.New("testing error")

func TestTransaction(t *testing.T) {
	ss := InitTestDB(t)

	t.Run("InTransaction", func(t *testing.T) {
		cmd := &models.AddApiKeyCommand{Key: "secret-key", Name: "key", OrgId: 1}

		err := AddApiKey(cmd)
		require.NoError(t, err)

		t.Run("can update key", func(t *testing.T) {
			err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
				return deleteAPIKey(sess, cmd.Result.Id, 1)
			})

			require.NoError(t, err)

			query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
			err = GetApiKeyById(query)
			require.Equal(t, models.ErrInvalidApiKey, err)
		})

		t.Run("won't update if one handler fails", func(t *testing.T) {
			err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
				err := deleteAPIKey(sess, cmd.Result.Id, 1)
				if err != nil {
					return err
				}

				return ErrProvokedError
			})

			require.Equal(t, ErrProvokedError, err)

			query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
			err = GetApiKeyById(query)
			require.NoError(t, err)
			require.Equal(t, cmd.Result.Id, query.Result.Id)
		})
	})
}
