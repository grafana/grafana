package image

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/screenshot"
	"github.com/grafana/grafana/pkg/util"
)

func TestScreenshotImageService(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	var (
		cache       = NewMockCacheService(ctrl)
		images      = store.NewFakeImageStore(t)
		limiter     = screenshot.NoOpRateLimiter{}
		screenshots = screenshot.NewMockScreenshotService(ctrl)
		uploads     = imguploader.NewMockImageUploader(ctrl)
	)

	s := NewScreenshotImageService(cache, &limiter, log.NewNopLogger(), screenshots, 5*time.Second, images,
		NewUploadingService(uploads, prometheus.NewRegistry()))

	ctx := context.Background()

	t.Run("image is taken, uploaded, saved to database and cached", func(t *testing.T) {
		// assert that the cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "oyh1kYgaJwM=").Return(models.Image{}, false)

		// assert that a screenshot is taken
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "foo",
			PanelID:      1,
			Timeout:      5 * time.Second,
		}).Return(&screenshot.Screenshot{
			Path: "foo.png",
		}, nil)

		// assert that the screenshot is made into an image and uploaded
		uploads.EXPECT().Upload(gomock.Any(), "foo.png").
			Return("https://example.com/foo.png", nil)

		// assert that the image is saved into the database
		expected := models.Image{
			ID:    1,
			Token: "foo",
			Path:  "foo.png",
			URL:   "https://example.com/foo.png",
		}

		// assert that the image is saved into the cache
		cache.EXPECT().Set(gomock.Any(), "oyh1kYgaJwM=", expected).Return(nil)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "foo",
			DashboardUID: util.Pointer("foo"),
			PanelID:      util.Pointer(int64(1))})
		require.NoError(t, err)
		assert.Equal(t, expected, *image)
	})

	t.Run("image is taken, upload return error, saved to database without URL and cached", func(t *testing.T) {
		// assert that the cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "yszV9tgmKAo=").Return(models.Image{}, false)

		// assert that a screenshot is taken
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "bar",
			PanelID:      1,
			Timeout:      5 * time.Second,
		}).Return(&screenshot.Screenshot{
			Path: "bar.png",
		}, nil)

		// the screenshot is made into an image and uploaded, but the upload returns an error
		uploads.EXPECT().Upload(gomock.Any(), "bar.png").
			Return("", errors.New("failed to upload bar.png"))

		// and then saved into the database, but without a URL
		expected := models.Image{
			ID:    2,
			Token: "bar",
			Path:  "bar.png",
		}

		// assert that the image is saved into the cache, but without a URL
		cache.EXPECT().Set(gomock.Any(), "yszV9tgmKAo=", expected).Return(nil)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "bar",
			DashboardUID: util.Pointer("bar"),
			PanelID:      util.Pointer(int64(1))})
		require.NoError(t, err)
		assert.Equal(t, expected, *image)
	})

	t.Run("image is returned from cache", func(t *testing.T) {
		expected := models.Image{Path: "baz.png", URL: "https://example.com/baz.png"}

		// assert that the cache is checked for an existing image and it is returned
		cache.EXPECT().Get(gomock.Any(), "he399rFDBPI=").Return(expected, true)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "baz",
			DashboardUID: util.Pointer("baz"),
			PanelID:      util.Pointer(int64(1))})
		require.NoError(t, err)
		assert.Equal(t, expected, *image)
	})

	t.Run("error is returned when timeout is exceeded", func(t *testing.T) {
		// assert that the cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "TTHub8HUe2U=").Return(models.Image{}, false)

		// assert that when the timeout is exceeded an error is returned
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "qux",
			PanelID:      1,
			Timeout:      5 * time.Second,
		}).Return(nil, context.DeadlineExceeded)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "qux",
			DashboardUID: util.Pointer("qux"),
			PanelID:      util.Pointer(int64(1))})
		assert.EqualError(t, err, "context deadline exceeded")
		assert.Nil(t, image)
	})
}
