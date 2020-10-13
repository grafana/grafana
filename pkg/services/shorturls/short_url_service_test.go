package shorturls

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShortURLService(t *testing.T) {
	user := &models.SignedInUser{UserId: 1}
	sqlStore := sqlstore.InitTestDB(t)

	t.Run("User can create and read short URLs", func(t *testing.T) {
		const refPath = "mock/path?test=true"

		service := ShortURLService{SQLStore: sqlStore}

		uid, err := service.CreateShortURL(context.Background(), user, refPath)
		require.NoError(t, err)
		assert.NotEmpty(t, uid)

		path, err := service.GetFullURLByUID(context.Background(), user, uid)
		require.NoError(t, err)
		assert.NotEmpty(t, path)
		assert.Equal(t, refPath, path)
	})

	t.Run("User cannot look up nonexistent short URLs", func(t *testing.T) {
		service := ShortURLService{SQLStore: sqlStore}

		path, err := service.GetFullURLByUID(context.Background(), user, "testnotfounduid")
		require.Error(t, err)
		assert.Empty(t, path)
		assert.Equal(t, models.ErrShortURLNotFound, err)
	})
}
