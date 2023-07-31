package image

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
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
		dbs         = dashboards.NewFakeDashboardService(t)
		images      = store.NewFakeImageStore(t)
		limiter     = screenshot.NoOpRateLimiter{}
		screenshots = screenshot.NewMockScreenshotService(ctrl)
		uploads     = imguploader.NewMockImageUploader(ctrl)
	)

	s := NewScreenshotImageService(cache, dbs, &limiter, log.NewNopLogger(), screenshots, 5*time.Second, images,
		NewUploadingService(uploads, prometheus.NewRegistry()))

	ctx := context.Background()

	t.Run("image is taken, uploaded, saved to database and cached", func(t *testing.T) {
		// cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "EBfkKS/dJKg=").Return(models.Image{}, false)

		// dashboard is retrieved from the dashboard service to set the time range
		dbs.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{OrgID: 1, UID: "foo"}).
			Return(&dashboards.Dashboard{Data: simplejson.MustJson([]byte(`{"time":{"from":"now-5m","to":"now"}}`))}, nil)

		// screenshot is taken
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "foo",
			PanelID:      1,
			From:         "now-5m",
			To:           "now",
			Timeout:      5 * time.Second,
		}).Return(&screenshot.Screenshot{
			Path: "foo.png",
		}, nil)

		// screenshot is made into an image and uploaded
		uploads.EXPECT().Upload(gomock.Any(), "foo.png").
			Return("https://example.com/foo.png", nil)

		// expected image saved to the database
		expected := models.Image{
			ID:    1,
			Token: "foo",
			Path:  "foo.png",
			URL:   "https://example.com/foo.png",
		}

		// image is written to the cache
		cache.EXPECT().Set(gomock.Any(), "EBfkKS/dJKg=", expected).Return(nil)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "foo",
			DashboardUID: util.Pointer("foo"),
			PanelID:      util.Pointer(int64(1))})
		require.NoError(t, err)
		assert.Equal(t, expected, *image)
	})

	t.Run("image is taken, upload return error, saved to database without URL and cached", func(t *testing.T) {
		// cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "SJFXw2sGMe8=").Return(models.Image{}, false)

		// dashboard is retrieved from the dashboard service to set the time range
		dbs.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{OrgID: 1, UID: "bar"}).
			Return(&dashboards.Dashboard{Data: simplejson.MustJson([]byte(`{"time":{"from":"now-5m","to":"now"}}`))}, nil)

		// screenshot is taken
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "bar",
			PanelID:      1,
			From:         "now-5m",
			To:           "now",
			Timeout:      5 * time.Second,
		}).Return(&screenshot.Screenshot{
			Path: "bar.png",
		}, nil)

		// screenshot is made into an image and uploaded but the upload returns an error
		uploads.EXPECT().Upload(gomock.Any(), "bar.png").
			Return("", errors.New("failed to upload bar.png"))

		// image is saved to the database without a URL
		expected := models.Image{
			ID:    2,
			Token: "bar",
			Path:  "bar.png",
		}

		// image is written to the cache without a URL
		cache.EXPECT().Set(gomock.Any(), "SJFXw2sGMe8=", expected).Return(nil)

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

		// dashboard is retrieved from the dashboard service to set the time range
		dbs.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{OrgID: 1, UID: "baz"}).
			Return(&dashboards.Dashboard{Data: simplejson.MustJson([]byte(`{"time":{"from":"now-5m","to":"now"}}`))}, nil)

		// cache is checked for an existing image and it is returned
		cache.EXPECT().Get(gomock.Any(), "qKS1yydWvqc=").Return(expected, true)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "baz",
			DashboardUID: util.Pointer("baz"),
			PanelID:      util.Pointer(int64(1))})
		require.NoError(t, err)
		assert.Equal(t, expected, *image)
	})

	t.Run("error is returned when timeout is exceeded", func(t *testing.T) {
		// cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "lSt00jwKht4=").Return(models.Image{}, false)

		// dashboard is retrieved from the dashboard service to set the time range
		dbs.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{OrgID: 1, UID: "qux"}).
			Return(&dashboards.Dashboard{Data: simplejson.MustJson([]byte(`{"time":{"from":"now-5m","to":"now"}}`))}, nil)

		// when the timeout is exceeded an error is returned
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "qux",
			PanelID:      1,
			From:         "now-5m",
			To:           "now",
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

	t.Run("dashboard not found returns error", func(t *testing.T) {
		// return ErrDashboardNotFound for unknown dashboard
		dbs.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{OrgID: 1, UID: "quux"}).
			Return(nil, dashboards.ErrDashboardNotFound)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "quux",
			DashboardUID: util.Pointer("quux"),
			PanelID:      util.Pointer(int64(1))})
		assert.EqualError(t, err, "Dashboard not found")
		assert.Nil(t, image)
	})

	t.Run("dashboard with missing time range uses default", func(t *testing.T) {
		// cache is checked for an existing image
		cache.EXPECT().Get(gomock.Any(), "ae76t6+Elrs=").Return(models.Image{}, false)

		// dashboard is retrieved from the dashboard service but with missing time range
		dbs.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{OrgID: 1, UID: "corge"}).
			Return(&dashboards.Dashboard{Data: simplejson.MustJson([]byte(`{}`))}, nil)

		// screenshot is taken
		screenshots.EXPECT().Take(gomock.Any(), screenshot.ScreenshotOptions{
			OrgID:        1,
			DashboardUID: "corge",
			PanelID:      1,
			From:         screenshot.DefaultFrom,
			To:           screenshot.DefaultTo,
			Timeout:      5 * time.Second,
		}).Return(&screenshot.Screenshot{
			Path: "corge.png",
		}, nil)

		// screenshot is made into an image and uploaded
		uploads.EXPECT().Upload(gomock.Any(), "corge.png").
			Return("https://example.com/corge.png", nil)

		// image is saved to the database without a URL
		expected := models.Image{
			ID:    3,
			Token: "corge",
			Path:  "corge.png",
			URL:   "https://example.com/corge.png",
		}

		// image is written to the cache without a URL
		cache.EXPECT().Set(gomock.Any(), "ae76t6+Elrs=", expected).Return(nil)

		image, err := s.NewImage(ctx, &models.AlertRule{
			OrgID:        1,
			UID:          "corge",
			DashboardUID: util.Pointer("corge"),
			PanelID:      util.Pointer(int64(1))})
		require.NoError(t, err)
		assert.Equal(t, expected, *image)
	})
}
