package shorturls

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShortURLService(t *testing.T) {
	service := ShortURLService{
		user: &models.SignedInUser{UserId: 1},
	}

	mockUID := "testuid"
	mockNotFoundUid := "testnotfounduid"
	mockPath := "mock/path?test=true"
	mockShortURL := models.ShortUrl{
		Uid:       mockUID,
		Path:      mockPath,
		CreatedBy: service.user.UserId,
		CreatedAt: 1,
	}

	bus.AddHandler("test", func(query *models.CreateShortURLCommand) error {
		query.Result = &mockShortURL
		return nil
	})

	bus.AddHandler("test", func(query *models.GetShortURLByUIDQuery) error {
		if query.UID == mockNotFoundUid {
			return models.ErrShortURLNotFound
		}
		result := &mockShortURL
		query.Result = result
		return nil
	})

	t.Run("User can create and read short URLs", func(t *testing.T) {
		uid, err := service.CreateShortURL(mockPath)
		require.NoError(t, err)
		assert.NotEmpty(t, uid)
		assert.Equal(t, mockUID, uid)
		path, err := service.GetFullURLByUID(uid)
		require.NoError(t, err)
		assert.NotEmpty(t, path)
		assert.Equal(t, mockPath, path)
	})

	t.Run("User cannot look up nonexistent short URLs", func(t *testing.T) {
		service := ShortURLService{
			user: &models.SignedInUser{UserId: 1},
		}

		path, err := service.GetFullURLByUID(mockNotFoundUid)
		require.Error(t, err)
		assert.Empty(t, path)
		assert.Equal(t, models.ErrShortURLNotFound, err)
	})
}
