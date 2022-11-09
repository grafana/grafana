package image

import (
	"context"
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/screenshot"
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

	s := NewScreenshotImageService(cache, &limiter, log.NewNopLogger(), screenshots, images,
		NewUploadingService(uploads, prometheus.NewRegistry()))

	ctx := context.Background()

	// assert that the cache is checked for an existing image
	cache.EXPECT().Get(gomock.Any(), "M2DGZaRLXtg=").Return(models.Image{}, false)

	// assert that a screenshot is taken
	screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
		DashboardUID: "foo",
		PanelID:      1,
		Timeout:      screenshotTimeout,
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
	cache.EXPECT().Set(gomock.Any(), "M2DGZaRLXtg=", expected).Return(nil)

	image, err := s.NewImage(ctx, &models.AlertRule{
		OrgID:        1,
		UID:          "foo",
		DashboardUID: pointer.String("foo"),
		PanelID:      pointer.Int64(1)})
	require.NoError(t, err)
	assert.Equal(t, expected, *image)

	// assert that the cache is checked for an existing image
	cache.EXPECT().Get(gomock.Any(), "rTOWVcbRidk=").Return(models.Image{}, false)

	// assert that a screenshot is taken
	screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
		DashboardUID: "bar",
		PanelID:      1,
		Timeout:      screenshotTimeout,
	}).Return(&screenshot.Screenshot{
		Path: "bar.png",
	}, nil)

	// the screenshot is made into an image and uploaded, but the upload returns an error
	uploads.EXPECT().Upload(gomock.Any(), "bar.png").
		Return("", errors.New("failed to upload bar.png"))

	// and then saved into the database, but without a URL
	expected = models.Image{
		ID:    2,
		Token: "bar",
		Path:  "bar.png",
	}

	// assert that the image is saved into the cache, but without a URL
	cache.EXPECT().Set(gomock.Any(), "rTOWVcbRidk=", expected).Return(nil)

	image, err = s.NewImage(ctx, &models.AlertRule{
		OrgID:        1,
		UID:          "bar",
		DashboardUID: pointer.String("bar"),
		PanelID:      pointer.Int64(1)})
	require.NoError(t, err)
	assert.Equal(t, expected, *image)

	expected = models.Image{Path: "baz.png", URL: "https://example.com/baz.png"}

	// assert that the cache is checked for an existing image and it is returned
	cache.EXPECT().Get(gomock.Any(), "8hJuVe20rVE=").Return(expected, true)

	image, err = s.NewImage(ctx, &models.AlertRule{
		OrgID:        1,
		UID:          "baz",
		DashboardUID: pointer.String("baz"),
		PanelID:      pointer.Int64(1)})
	require.NoError(t, err)
	assert.Equal(t, expected, *image)
}
