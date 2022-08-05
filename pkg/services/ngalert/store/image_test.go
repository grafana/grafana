package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

func createTestImg(fakeUrl string, fakePath string) *models.Image {
	return &models.Image{
		ID:    0,
		Token: "",
		Path:  fakeUrl + "local",
		URL:   fakeUrl,
	}
}

func addID(img *models.Image, id int64) *models.Image {
	img.ID = id
	return img
}

func addToken(img *models.Image) *models.Image {
	token, err := uuid.NewRandom()
	if err != nil {
		panic("wat")
	}
	img.Token = token.String()
	return img
}

func TestIntegrationSaveAndGetImage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	mockTimeNow()
	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// Here are some images to save.
	imgs := []struct {
		name   string
		img    *models.Image
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

func TestIntegrationGetImages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	mockTimeNow()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// create an image foo.png
	img1 := models.Image{Path: "foo.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &img1))

	// GetImages should return the first image
	imgs, err := dbstore.GetImages(ctx, []string{img1.Token})
	require.NoError(t, err)
	assert.Equal(t, []models.Image{img1}, imgs)

	// create another image bar.png
	img2 := models.Image{Path: "bar.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &img2))

	// GetImages should return both images
	imgs, err = dbstore.GetImages(ctx, []string{img1.Token, img2.Token})
	require.NoError(t, err)
	assert.ElementsMatch(t, []models.Image{img1, img2}, imgs)

	// GetImages should return the first image
	imgs, err = dbstore.GetImages(ctx, []string{img1.Token})
	require.NoError(t, err)
	assert.Equal(t, []models.Image{img1}, imgs)

	// GetImages should return the second image
	imgs, err = dbstore.GetImages(ctx, []string{img2.Token})
	require.NoError(t, err)
	assert.Equal(t, []models.Image{img2}, imgs)

	// GetImages should return the first image and an error
	imgs, err = dbstore.GetImages(ctx, []string{img1.Token, "unknown"})
	assert.EqualError(t, err, "image not found")
	assert.Equal(t, []models.Image{img1}, imgs)

	// GetImages should return no images for no tokens
	imgs, err = dbstore.GetImages(ctx, []string{})
	require.NoError(t, err)
	assert.Len(t, imgs, 0)

	// GetImages should return no images for nil tokens
	imgs, err = dbstore.GetImages(ctx, nil)
	require.NoError(t, err)
	assert.Len(t, imgs, 0)
}

func TestIntegrationDeleteExpiredImages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	mockTimeNow()
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// Save two images.
	imgs := []*models.Image{
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
