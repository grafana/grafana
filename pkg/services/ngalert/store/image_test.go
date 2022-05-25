//go:build integration
// +build integration

package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/gofrs/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

func createTestImg(fakeUrl string, fakePath string) *store.Image {
	return &store.Image{
		ID:    0,
		Token: "",
		Path:  fakeUrl + "local",
		URL:   fakeUrl,
	}
}

func addID(img *store.Image, id int64) *store.Image {
	img.ID = id
	return img
}

func addToken(img *store.Image) *store.Image {
	token, err := uuid.NewV4()
	if err != nil {
		panic("wat")
	}
	img.Token = token.String()
	return img
}

func TestIntegrationSaveAndGetImage(t *testing.T) {
	mockTimeNow()
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// Here are some images to save.
	imgs := []struct {
		name   string
		img    *store.Image
		errors bool
	}{
		{
			"with file path",
			createTestImg("", "path"),
			false,
		},
		{
			"with URL",
			createTestImg("url", ""),
			false,
		},
		{
			"ID already set, should not change",
			addToken(addID(createTestImg("Foo", ""), 123)),
			true,
		},
	}

	for _, test := range imgs {
		t.Run(test.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
			err := dbstore.SaveImage(ctx, test.img)
			if test.errors {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			returned, err := dbstore.GetImage(ctx, test.img.Token)
			assert.NoError(t, err, "Shouldn't error when getting the image")
			assert.Equal(t, test.img, returned)

			// Save again to test update path.
			err = dbstore.SaveImage(ctx, test.img)
			require.NoError(t, err, "Should have no error on second write")
			returned, err = dbstore.GetImage(ctx, test.img.Token)
			assert.NoError(t, err, "Shouldn't error when getting the image a second time")
			assert.Equal(t, test.img, returned)
		})
	}
}

func TestIntegrationDeleteExpiredImages(t *testing.T) {
	mockTimeNow()
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// Save two images.
	imgs := []*store.Image{
		createTestImg("", ""),
		createTestImg("", ""),
	}

	for _, img := range imgs {
		err := dbstore.SaveImage(ctx, img)
		require.NoError(t, err)
	}

	// Images are availabile
	img, err := dbstore.GetImage(ctx, imgs[0].Token)
	require.NoError(t, err)
	require.NotNil(t, img)

	img, err = dbstore.GetImage(ctx, imgs[1].Token)
	require.NoError(t, err)
	require.NotNil(t, img)

	// Wait until timeout.
	for i := 0; i < 120; i++ {
		store.TimeNow()
	}

	// Call expired
	err = dbstore.DeleteExpiredImages(ctx)
	require.NoError(t, err)

	// All images are gone.
	img, err = dbstore.GetImage(ctx, imgs[0].Token)
	require.Nil(t, img)
	require.Error(t, err)

	img, err = dbstore.GetImage(ctx, imgs[1].Token)
	require.Nil(t, img)
	require.Error(t, err)
}
