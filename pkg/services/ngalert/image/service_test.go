package image

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/imguploader"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/screenshot"
	"github.com/grafana/grafana/pkg/setting"
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
			DashboardUID: new("foo"),
			PanelID:      new(int64(1))})
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
			DashboardUID: new("bar"),
			PanelID:      new(int64(1))})
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
			DashboardUID: new("baz"),
			PanelID:      new(int64(1))})
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
			DashboardUID: new("qux"),
			PanelID:      new(int64(1))})
		assert.EqualError(t, err, "context deadline exceeded")
		assert.Nil(t, image)
	})
}

func TestAsyncScreenshotImageService(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingAsyncImageUpload)
	cache := NewInmemCacheService(time.Minute, prometheus.NewRegistry())
	synctest.Test(t, func(t *testing.T) {
		ctrl := gomock.NewController(t)
		images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t)}
		screenshots := screenshot.NewMockScreenshotService(ctrl)
		uploads := imguploader.NewMockImageUploader(ctrl)
		s := NewScreenshotImageService(cache, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(), screenshots,
			5*time.Second, images, NewUploadingService(uploads, prometheus.NewRegistry()))
		rule := &models.AlertRule{OrgID: 1, DashboardUID: new("foo"), PanelID: new(int64(1))}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		release := make(chan struct{})
		defer func() {
			close(release)
			synctest.Wait()
		}()
		var screenshotCtx context.Context
		screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, opts screenshot.ScreenshotOptions) (*screenshot.Screenshot, error) {
			screenshotCtx = ctx
			<-release
			return &screenshot.Screenshot{Path: "foo.png"}, ctx.Err()
		})
		uploads.EXPECT().Upload(gomock.Any(), "foo.png").Return("https://example.com/foo.png", nil)

		const callers = 10
		result := make(chan imageResult, callers)
		for range callers {
			go func() {
				img, err := s.NewImage(ctx, rule)
				result <- imageResult{image: img, err: err}
			}()
		}
		synctest.Wait()
		var pending *models.Image
		select {
		case got := <-result:
			require.NoError(t, got.err)
			pending = got.image
		default:
			t.Fatal("NewImage blocked on screenshot rendering")
		}
		require.NotEmpty(t, pending.Token)
		require.Empty(t, pending.Path)
		require.Empty(t, pending.URL)
		for range callers - 1 {
			select {
			case got := <-result:
				require.NoError(t, got.err)
				require.Equal(t, *pending, *got.image)
			default:
				t.Fatal("concurrent NewImage blocked on screenshot rendering")
			}
		}
		stored, err := images.GetImage(ctx, pending.Token)
		require.NoError(t, err)
		storedWithCapture := *stored
		storedWithCapture.Capture = pending.Capture
		require.Equal(t, *pending, storedWithCapture)

		cached, err := s.NewImage(ctx, rule)
		require.NoError(t, err)
		require.Equal(t, pending.Token, cached.Token)
		cancel()
		require.NoError(t, screenshotCtx.Err(), "caller cancellation must not cancel the background screenshot")
		_, hasDeadline := screenshotCtx.Deadline()
		require.True(t, hasDeadline)
		release <- struct{}{}
		synctest.Wait()
		stored, err = images.GetImage(context.Background(), pending.Token)
		require.NoError(t, err)
		require.Equal(t, pending.ID, stored.ID)
		require.Equal(t, "foo.png", stored.Path)
		require.Equal(t, "https://example.com/foo.png", stored.URL)
		completed, err, done := pending.Capture.Result()
		require.True(t, done)
		require.NoError(t, err)
		require.Equal(t, *stored, completed)
		require.Empty(t, pending.Path, "the returned placeholder must not be mutated by background work")
		cached, err = s.NewImage(context.Background(), rule)
		require.NoError(t, err)
		require.Equal(t, *stored, *cached)
	})
}

func TestAsyncScreenshotImageServiceFailures(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingAsyncImageUpload)
	tests := []struct {
		name         string
		initialError bool
		captureError bool
		uploadError  bool
		updateError  bool
		wantPath     string
	}{
		{name: "placeholder persistence fails", initialError: true},
		{name: "rendering fails", captureError: true},
		{name: "upload fails but the screenshot remains available on disk", uploadError: true, wantPath: "foo.png"},
		{name: "completed image persistence fails", updateError: true},
		{name: "external storage disabled", wantPath: "foo.png"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctrl := gomock.NewController(t)
				images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t), saveError: func(_ context.Context, img *models.Image) error {
					if (tt.initialError && img.ID == 0) || (tt.updateError && img.ID != 0) {
						return errors.New("storage unavailable")
					}
					return nil
				}}
				screenshots := screenshot.NewMockScreenshotService(ctrl)
				var uploads *UploadingService
				if !tt.initialError {
					if tt.captureError {
						screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(nil, errors.New("renderer unavailable"))
					} else {
						screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(&screenshot.Screenshot{Path: "foo.png"}, nil)
					}
					if tt.uploadError {
						uploader := imguploader.NewMockImageUploader(ctrl)
						uploader.EXPECT().Upload(gomock.Any(), "foo.png").Return("", errors.New("upload unavailable"))
						uploads = NewUploadingService(uploader, prometheus.NewRegistry())
					}
				}
				s := NewScreenshotImageService(&NoOpCacheService{}, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(),
					screenshots, 5*time.Second, images, uploads)
				img, err := s.NewImage(context.Background(), &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))})
				if tt.initialError {
					require.ErrorContains(t, err, "failed to save image: storage unavailable")
					require.Nil(t, img)
					return
				}
				require.NoError(t, err)
				synctest.Wait()
				stored, err := images.GetImage(context.Background(), img.Token)
				require.NoError(t, err)
				require.Equal(t, img.ID, stored.ID)
				require.Equal(t, tt.wantPath, stored.Path)
				require.Empty(t, stored.URL)
			})
		})
	}
}

func TestAsyncScreenshotImageServiceRetriesFailedCapture(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingAsyncImageUpload)
	cache := NewInmemCacheService(time.Minute, prometheus.NewRegistry())
	synctest.Test(t, func(t *testing.T) {
		ctrl := gomock.NewController(t)
		images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t)}
		screenshots := screenshot.NewMockScreenshotService(ctrl)
		captureErr := errors.New("renderer unavailable")
		gomock.InOrder(
			screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(nil, captureErr),
			screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(&screenshot.Screenshot{Path: "foo.png"}, nil),
			screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(&screenshot.Screenshot{Path: "foo.png"}, nil),
		)
		s := NewScreenshotImageService(cache, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(), screenshots, 5*time.Second, images, nil)
		rule := &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))}
		failed, err := s.NewImage(context.Background(), rule)
		require.NoError(t, err)
		synctest.Wait()
		_, err, done := failed.Capture.Result()
		require.True(t, done)
		require.ErrorIs(t, err, captureErr)
		retry, err := s.NewImage(context.Background(), rule)
		require.NoError(t, err)
		require.NotSame(t, failed.Capture, retry.Capture)
		require.NotEqual(t, failed.Token, retry.Token)
		synctest.Wait()
		completed, err, done := retry.Capture.Result()
		require.True(t, done)
		require.NoError(t, err)
		require.Equal(t, "foo.png", completed.Path)
		require.Nil(t, completed.Capture)
		// The handle remains usable even after panel-cache eviction.
		time.Sleep(2 * time.Minute)
		refreshed, err := s.NewImage(context.Background(), rule)
		require.NoError(t, err)
		require.NotSame(t, retry.Capture, refreshed.Capture)
		synctest.Wait()
		again, err, done := retry.Capture.Result()
		require.True(t, done)
		require.NoError(t, err)
		require.Equal(t, completed, again)
	})
}

func TestAsyncScreenshotImageServiceCancellation(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingAsyncImageUpload)
	for _, stage := range []string{"render", "upload", "persist"} {
		for _, shutdown := range []bool{false, true} {
			name := stage + "/timeout"
			if shutdown {
				name = stage + "/shutdown"
			}
			t.Run(name, func(t *testing.T) {
				synctest.Test(t, func(t *testing.T) {
					ctrl := gomock.NewController(t)
					images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t)}
					screenshots := screenshot.NewMockScreenshotService(ctrl)
					var operationErr error
					block := func(ctx context.Context) {
						<-ctx.Done()
						operationErr = ctx.Err()
					}
					var uploads *UploadingService
					if stage == "render" {
						screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, _ screenshot.ScreenshotOptions) (*screenshot.Screenshot, error) {
							block(ctx)
							return nil, ctx.Err()
						})
					} else {
						screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(&screenshot.Screenshot{Path: "foo.png"}, nil)
						if stage == "upload" {
							uploader := imguploader.NewMockImageUploader(ctrl)
							uploader.EXPECT().Upload(gomock.Any(), "foo.png").DoAndReturn(func(ctx context.Context, _ string) (string, error) {
								block(ctx)
								return "", ctx.Err()
							})
							uploads = NewUploadingService(uploader, prometheus.NewRegistry())
						} else {
							images.saveError = func(ctx context.Context, img *models.Image) error {
								if img.ID != 0 {
									block(ctx)
									return ctx.Err()
								}
								return nil
							}
						}
					}
					s := NewScreenshotImageService(&NoOpCacheService{}, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(),
						screenshots, 5*time.Second, images, uploads)
					img, err := s.NewImage(context.Background(), &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))})
					require.NoError(t, err)
					synctest.Wait()
					if shutdown {
						ctx, cancel := context.WithCancel(context.Background())
						cancel()
						require.NoError(t, s.Run(ctx))
					} else {
						time.Sleep(5 * time.Second)
					}
					synctest.Wait()
					if shutdown {
						require.ErrorIs(t, operationErr, context.Canceled)
					} else {
						require.ErrorIs(t, operationErr, context.DeadlineExceeded)
					}
					stored, err := images.GetImage(context.Background(), img.Token)
					require.NoError(t, err)
					require.Empty(t, stored.URL)
					if stage == "upload" && !shutdown {
						require.Equal(t, "foo.png", stored.Path, "an upload timeout must preserve the local screenshot")
						completed, err, done := img.Capture.Result()
						require.True(t, done)
						require.NoError(t, err)
						require.Equal(t, *stored, completed)
					} else {
						require.Empty(t, stored.Path)
					}
				})
			})
		}
	}
}

func TestScreenshotImageServiceCaptureDisabled(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingAsyncImageUpload)
	cfg := setting.NewCfg()
	s, err := NewScreenshotImageServiceFromCfg(cfg, nil, nil, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	img, err := s.NewImage(context.Background(), &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))})
	require.ErrorIs(t, err, screenshot.ErrScreenshotsUnavailable)
	require.Nil(t, img)
}

func TestScreenshotImageServiceFlagEvaluatedPerCall(t *testing.T) {
	provider := &imageFlagProvider{}
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	synctest.Test(t, func(t *testing.T) {
		ctrl := gomock.NewController(t)
		screenshots := screenshot.NewMockScreenshotService(ctrl)
		screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).Return(&screenshot.Screenshot{Path: "foo.png"}, nil).Times(3)
		images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t)}
		s := NewScreenshotImageService(&NoOpCacheService{}, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(), screenshots,
			5*time.Second, images, nil)
		rule := &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))}
		for _, async := range []bool{true, false, true} {
			ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext("caller", map[string]any{"async": async}))
			img, err := s.NewImage(ctx, rule)
			require.NoError(t, err)
			if async {
				require.NotNil(t, img.Capture, "this call's evaluation context must enable async capture")
			} else {
				require.Nil(t, img.Capture)
				require.Equal(t, "foo.png", img.Path)
			}
			synctest.Wait()
		}
	})
	require.Equal(t, int32(3), provider.calls.Load())
}

func TestScreenshotImageServiceConstructorDoesNotEvaluateFlag(t *testing.T) {
	provider := &imageFlagProvider{}
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.Screenshots.Capture = true
	cfg.UnifiedAlerting.Screenshots.MaxConcurrentScreenshots = 1
	_, err := NewScreenshotImageServiceFromCfg(cfg, nil, nil, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	require.Zero(t, provider.calls.Load(), "flag evaluation belongs to NewImage")
}

func TestScreenshotImageServiceAsyncCallerDoesNotWaitForSyncFlight(t *testing.T) {
	provider := &imageFlagProvider{}
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	synctest.Test(t, func(t *testing.T) {
		ctrl := gomock.NewController(t)
		images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t)}
		screenshots := screenshot.NewMockScreenshotService(ctrl)
		release := make(chan struct{})
		defer func() {
			close(release)
			synctest.Wait()
		}()
		var captures int
		screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, _ screenshot.ScreenshotOptions) (*screenshot.Screenshot, error) {
			captures++
			<-release
			return &screenshot.Screenshot{Path: "foo.png"}, nil
		}).AnyTimes()
		s := NewScreenshotImageService(&NoOpCacheService{}, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(), screenshots, 5*time.Second, images, nil)
		rule := &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))}
		syncResult := make(chan imageResult, 1)
		go func() {
			img, err := s.NewImage(context.Background(), rule)
			syncResult <- imageResult{image: img, err: err}
		}()
		synctest.Wait()
		ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext("async-caller", map[string]any{"async": true}))
		asyncResult := make(chan imageResult, 1)
		go func() {
			img, err := s.NewImage(ctx, rule)
			asyncResult <- imageResult{image: img, err: err}
		}()
		synctest.Wait()
		select {
		case got := <-asyncResult:
			require.NoError(t, got.err)
			require.NotEmpty(t, got.image.Token)
			require.NotNil(t, got.image.Capture)
		default:
			t.Fatal("async caller blocked behind the synchronous flight")
		}
		select {
		case <-syncResult:
			t.Fatal("synchronous caller returned before rendering completed")
		default:
		}
		require.Equal(t, 2, captures, "mixed modes must use independent flights")
	})
}

func TestScreenshotImageServiceDisabledFlagWaitsForPendingCapture(t *testing.T) {
	provider := &imageFlagProvider{}
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	for _, tt := range []struct {
		name         string
		captureError bool
		cancelCaller bool
	}{
		{name: "cached capture completes"},
		{name: "cached capture fails", captureError: true},
		{name: "cached caller cancels", cancelCaller: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			cache := NewInmemCacheService(time.Minute, prometheus.NewRegistry())
			synctest.Test(t, func(t *testing.T) {
				ctrl := gomock.NewController(t)
				images := &asyncTestImageStore{ImageStore: store.NewFakeImageStore(t)}
				release := make(chan struct{}, 1)
				defer func() {
					close(release)
					synctest.Wait()
				}()
				captureErr := errors.New("renderer unavailable")
				var captureCtx context.Context
				screenshots := screenshot.NewMockScreenshotService(ctrl)
				screenshots.EXPECT().Take(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, _ screenshot.ScreenshotOptions) (*screenshot.Screenshot, error) {
					captureCtx = ctx
					<-release
					if tt.captureError {
						return nil, captureErr
					}
					return &screenshot.Screenshot{Path: "foo.png"}, nil
				})
				s := NewScreenshotImageService(cache, &screenshot.NoOpRateLimiter{}, log.NewNopLogger(), screenshots, 5*time.Second, images, nil)
				rule := &models.AlertRule{DashboardUID: new("foo"), PanelID: new(int64(1))}
				asyncCtx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext("async-caller", map[string]any{"async": true}))
				asyncResult := make(chan imageResult, 1)
				go func() {
					img, err := s.NewImage(asyncCtx, rule)
					asyncResult <- imageResult{image: img, err: err}
				}()
				synctest.Wait()
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				result := make(chan imageResult, 1)
				go func() {
					img, err := s.NewImage(ctx, rule)
					result <- imageResult{image: img, err: err}
				}()
				synctest.Wait()
				pending := <-asyncResult
				require.NoError(t, pending.err)
				require.NotNil(t, pending.image.Capture)
				select {
				case <-result:
					t.Fatal("disabled caller returned before the shared screenshot completed")
				default:
				}
				if tt.cancelCaller {
					cancel()
				} else {
					release <- struct{}{}
				}
				synctest.Wait()
				got := <-result
				switch {
				case tt.cancelCaller:
					require.ErrorIs(t, got.err, context.Canceled)
					require.Nil(t, got.image)
					require.NoError(t, captureCtx.Err(), "canceling the waiter must not cancel the shared screenshot")
				case tt.captureError:
					require.ErrorIs(t, got.err, captureErr)
					require.Nil(t, got.image)
				default:
					require.NoError(t, got.err)
					require.Equal(t, pending.image.Token, got.image.Token)
					require.Equal(t, "foo.png", got.image.Path)
					require.Nil(t, got.image.Capture)
				}
			})
		})
	}
}

type imageFlagProvider struct {
	openfeature.NoopProvider
	calls atomic.Int32
}

func (p *imageFlagProvider) BooleanEvaluation(_ context.Context, _ string, _ bool, attributes openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	p.calls.Add(1)
	async, _ := attributes["async"].(bool)
	return openfeature.BoolResolutionDetail{Value: async}
}

type asyncTestImageStore struct {
	store.ImageStore
	saveError func(context.Context, *models.Image) error
}

type imageResult struct {
	image *models.Image
	err   error
}

func (s *asyncTestImageStore) SaveImage(ctx context.Context, img *models.Image) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s.saveError != nil {
		if err := s.saveError(ctx, img); err != nil {
			return err
		}
	}
	copy := *img
	if copy.Token == "" {
		copy.Token = util.GenerateShortUID()
	}
	if err := s.ImageStore.SaveImage(ctx, &copy); err != nil {
		return err
	}
	*img = copy
	return nil
}
