package shortUrls

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestShortUrlService(t *testing.T) {
	service := shortUrlServiceImpl{
		user: &models.SignedInUser{UserId: 1},
	}

	mockUid := "testuid"
	mockNotFoundUid := "testnotfounduid"
	mockPath := "mock/path?test=true"
	mockShortUrl := models.ShortUrl{
		Uid:       mockUid,
		Path:      mockPath,
		CreatedBy: service.user.UserId,
		CreatedAt: 1,
	}

	bus.AddHandler("test", func(query *models.CreateShortUrlCommand) error {
		query.Result = &mockShortUrl
		return nil
	})

	bus.AddHandler("test", func(query *models.GetFullUrlQuery) error {
		if query.Uid == mockNotFoundUid {
			return models.ErrShortUrlNotFound
		}
		result := &mockShortUrl
		query.Result = result
		return nil
	})

	t.Run("User can create and read short URLs", func(t *testing.T) {
		uid, err := service.CreateShortUrl(1, mockPath)
		assert.Nil(t, err)
		assert.NotEmpty(t, uid)
		assert.Equal(t, uid, mockUid)
		path, err := service.GetFullUrlByUID(1, uid)
		assert.Nil(t, err)
		assert.NotEmpty(t, path)
		assert.Equal(t, path, mockPath)
	})

	t.Run("User cannot look up nonexistent short urls", func(t *testing.T) {
		service := shortUrlServiceImpl{
			user: &models.SignedInUser{UserId: 1},
		}

		path, err := service.GetFullUrlByUID(1, mockNotFoundUid)
		assert.NotNil(t, err)
		assert.Empty(t, path)
		assert.Equal(t, err, models.ErrShortUrlNotFound)
	})
}
