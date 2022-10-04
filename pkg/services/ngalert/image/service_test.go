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
		images      = store.NewFakeImageStore(t)
		limiter     = screenshot.NoOpRateLimiter{}
		screenshots = screenshot.NewMockScreenshotService(ctrl)
		uploads     = imguploader.NewMockImageUploader(ctrl)
	)

	s := NewScreenshotImageService(&limiter, log.NewNopLogger(), screenshots, images,
		NewUploadingService(uploads, prometheus.NewRegistry()))

	ctx := context.Background()

	// assert that a screenshot is taken
	screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
		DashboardUID: "foo",
		PanelID:      1,
		Timeout:      screenshotTimeout,
	}).Return(&screenshot.Screenshot{
		Path: "foo.png",
	}, nil)

	// the screenshot is made into an image and uploaded
	uploads.EXPECT().Upload(gomock.Any(), "foo.png").
		Return("https://example.com/foo.png", nil)

	// and then saved into the database
	expected := models.Image{
		ID:    1,
		Token: "foo",
		Path:  "foo.png",
		URL:   "https://example.com/foo.png",
	}

	image, err := s.NewImage(ctx, &models.AlertRule{
		DashboardUID: pointer.String("foo"),
		PanelID:      pointer.Int64(1)})
	require.NoError(t, err)
	assert.Equal(t, expected, *image)

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

	image, err = s.NewImage(ctx, &models.AlertRule{
		DashboardUID: pointer.String("bar"),
		PanelID:      pointer.Int64(1)})
	require.NoError(t, err)
	assert.Equal(t, expected, *image)
}
