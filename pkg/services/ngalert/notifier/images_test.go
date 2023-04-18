package notifier

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/stretchr/testify/require"
)

func TestGetImage(t *testing.T) {
	fakeImageStore := store.NewFakeImageStore(t)
	store := newImageStore(fakeImageStore)

	t.Run("queries by token when it gets a token", func(tt *testing.T) {
		img := models.Image{
			Token: "test",
			URL:   "http://localhost:1234",
			Path:  "test.png",
		}
		err := fakeImageStore.SaveImage(context.Background(), &img)
		require.NoError(t, err)

		savedImg, err := store.GetImage(context.Background(), "token://"+img.Token)
		require.NoError(tt, err)
		require.Equal(tt, savedImg.Token, img.Token)
		require.Equal(tt, savedImg.URL, img.URL)
		require.Equal(tt, savedImg.Path, img.Path)
	})

	t.Run("queries by URL when it gets a URL", func(tt *testing.T) {
		img := models.Image{
			Token: "test",
			Path:  "test.png",
			URL:   "https://test.com/test.png",
		}
		err := fakeImageStore.SaveImage(context.Background(), &img)
		require.NoError(t, err)

		savedImg, err := store.GetImage(context.Background(), img.URL)
		require.NoError(tt, err)
		require.Equal(tt, savedImg.Token, img.Token)
		require.Equal(tt, savedImg.URL, img.URL)
		require.Equal(tt, savedImg.Path, img.Path)
	})
}
