package shorturls

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestShortURLService(t *testing.T) {
	service := shortURLServiceImpl{
		user: &models.SignedInUser{UserId: 1},
	}

	mockUid := "testuid"
	mockNotFoundUid := "testnotfounduid"
	mockPath := "mock/path?test=true"
	mockShortURL := models.ShortUrl{
		Uid:       mockUid,
		Path:      mockPath,
		CreatedBy: service.user.UserId,
		CreatedAt: 1,
	}

	bus.AddHandler("test", func(query *models.CreateShortURLCommand) error {
		query.Result = &mockShortURL
		return nil
	})

	bus.AddHandler("test", func(query *models.GetShortURLByUIDQuery) error {
		if query.Uid == mockNotFoundUid {
			return models.ErrShortURLNotFound
		}
		result := &mockShortURL
		query.Result = result
		return nil
	})

	t.Run("User can create and read short URLs", func(t *testing.T) {
		uid, err := service.CreateShortURL(mockPath)
		assert.Nil(t, err)
		assert.NotEmpty(t, uid)
		assert.Equal(t, uid, mockUid)
		path, err := service.GetFullURLByUID(uid)
		assert.Nil(t, err)
		assert.NotEmpty(t, path)
		assert.Equal(t, path, mockPath)
	})

	t.Run("User cannot look up nonexistent short urls", func(t *testing.T) {
		service := shortURLServiceImpl{
			user: &models.SignedInUser{UserId: 1},
		}

		path, err := service.GetFullURLByUID(mockNotFoundUid)
		assert.NotNil(t, err)
		assert.Empty(t, path)
		assert.Equal(t, err, models.ErrShortURLNotFound)
	})
}
