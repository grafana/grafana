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

	t.Run("deletes URL when it uses file scheme", func(tt *testing.T) {
		img := models.Image{
			Path: "test.png",
			URL:  "file://test.png",
		}
		err := fakeImageStore.SaveImage(context.Background(), &img)
		require.NoError(t, err)

		savedImg, err := store.GetImage(context.Background(), img.URL)
		require.NoError(tt, err)
		require.Equal(tt, "", savedImg.URL)

		// Path should stay unchanged.
		require.Equal(tt, img.Path, savedImg.Path)
	})

	t.Run("preserves the URL when it's public", func(tt *testing.T) {
		img := models.Image{
			Path: "test.png",
			URL:  "https://test.com/test.png",
		}
		err := fakeImageStore.SaveImage(context.Background(), &img)
		require.NoError(t, err)

		savedImg, err := store.GetImage(context.Background(), img.URL)
		require.NoError(tt, err)
		require.Equal(tt, img.URL, savedImg.URL)

		// Path should stay unchanged.
		require.Equal(tt, img.Path, savedImg.Path)
	})
}
