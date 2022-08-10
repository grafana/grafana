package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests"
)

func TestIntegrationSaveAndGetImage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// our database schema uses second precision for timestamps
	store.TimeNow = func() time.Time {
		return time.Now().Truncate(time.Second)
	}

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// create an image with a path on disk
	image1 := models.Image{Path: "example.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &image1))
	require.NotEqual(t, "", image1.Token)

	// image should not have expired
	assert.False(t, image1.HasExpired())
	assert.Equal(t, image1.ExpiresAt, image1.CreatedAt.Add(24*time.Hour))

	// should return the image with a path on disk
	result1, err := dbstore.GetImage(ctx, image1.Token)
	require.NoError(t, err)
	assert.Equal(t, image1, *result1)

	// save the image a second time should not change the expiration time
	ts := image1.ExpiresAt
	require.NoError(t, dbstore.SaveImage(ctx, &image1))
	assert.Equal(t, image1.ExpiresAt, ts)

	// create an image with a URL
	image2 := models.Image{URL: "https://example.com/example.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &image2))
	require.NotEqual(t, "", image2.Token)

	// image should not have expired
	assert.False(t, image2.HasExpired())
	assert.Equal(t, image2.ExpiresAt, image2.CreatedAt.Add(24*time.Hour))

	// should return the image with a URL
	result2, err := dbstore.GetImage(ctx, image2.Token)
	require.NoError(t, err)
	assert.Equal(t, image2, *result2)

	// expired image should not be returned
	image1.ExpiresAt = time.Now().Add(-time.Second)
	require.NoError(t, dbstore.SaveImage(ctx, &image1))
	result1, err = dbstore.GetImage(ctx, image1.Token)
	assert.EqualError(t, err, "image not found")
	assert.Nil(t, result1)
}

func TestIntegrationGetImages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// our database schema uses second precision for timestamps
	store.TimeNow = func() time.Time {
		return time.Now().Truncate(time.Second)
	}

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// create an image with a path on disk
	image1 := models.Image{Path: "example.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &image1))

	// should return the first image
	images, mismatched, err := dbstore.GetImages(ctx, []string{image1.Token})
	require.NoError(t, err)
	assert.Len(t, mismatched, 0)
	assert.Equal(t, []models.Image{image1}, images)

	// create an image with a URL
	image2 := models.Image{Path: "https://example.com/example.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &image2))

	// should return both images
	images, mismatched, err = dbstore.GetImages(ctx, []string{image1.Token, image2.Token})
	require.NoError(t, err)
	assert.Len(t, mismatched, 0)
	assert.ElementsMatch(t, []models.Image{image1, image2}, images)

	// should return the first image
	images, mismatched, err = dbstore.GetImages(ctx, []string{image1.Token})
	require.NoError(t, err)
	assert.Len(t, mismatched, 0)
	assert.Equal(t, []models.Image{image1}, images)

	// should return the second image
	images, mismatched, err = dbstore.GetImages(ctx, []string{image2.Token})
	require.NoError(t, err)
	assert.Len(t, mismatched, 0)
	assert.Equal(t, []models.Image{image2}, images)

	// should return the first image and an error
	images, mismatched, err = dbstore.GetImages(ctx, []string{image1.Token, "unknown"})
	assert.EqualError(t, err, "image not found")
	assert.Equal(t, []string{"unknown"}, mismatched)
	assert.Equal(t, []models.Image{image1}, images)

	// should return no images for no tokens
	images, mismatched, err = dbstore.GetImages(ctx, []string{})
	require.NoError(t, err)
	assert.Len(t, mismatched, 0)
	assert.Len(t, images, 0)

	// should return no images for nil tokens
	images, mismatched, err = dbstore.GetImages(ctx, nil)
	require.NoError(t, err)
	assert.Len(t, mismatched, 0)
	assert.Len(t, images, 0)

	// expired image should not be returned
	image1.ExpiresAt = time.Now().Add(-time.Second)
	require.NoError(t, dbstore.SaveImage(ctx, &image1))
	images, mismatched, err = dbstore.GetImages(ctx, []string{image1.Token, image2.Token})
	assert.EqualError(t, err, "image not found")
	assert.Equal(t, []string{image1.Token}, mismatched)
	assert.Equal(t, []models.Image{image2}, images)
}

func TestIntegrationDeleteExpiredImages(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// our database schema uses second precision for timestamps
	store.TimeNow = func() time.Time {
		return time.Now().Truncate(time.Second)
	}

	ctx := context.Background()
	_, dbstore := tests.SetupTestEnv(t, baseIntervalSeconds)

	// create two images
	image1 := models.Image{Path: "example.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &image1))
	image2 := models.Image{URL: "https://example.com/example.png"}
	require.NoError(t, dbstore.SaveImage(ctx, &image2))

	s := dbstore.SQLStore.NewSession(ctx)
	t.Cleanup(s.Close)

	// should return both images
	var result1, result2 models.Image
	ok, err := s.Where("token = ?", image1.Token).Get(&result1)
	require.NoError(t, err)
	assert.True(t, ok)
	ok, err = s.Where("token = ?", image2.Token).Get(&result2)
	require.NoError(t, err)
	assert.True(t, ok)

	// should delete expired image
	image1.ExpiresAt = time.Now().Add(-time.Second)
	require.NoError(t, dbstore.SaveImage(ctx, &image1))
	n, err := dbstore.DeleteExpiredImages(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)

	// should return just the second image
	ok, err = s.Where("token = ?", image1.Token).Get(&result1)
	require.NoError(t, err)
	assert.False(t, ok)
	ok, err = s.Where("token = ?", image2.Token).Get(&result2)
	require.NoError(t, err)
	assert.True(t, ok)
}
