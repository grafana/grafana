package notifier

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	alertingImages "github.com/grafana/alerting/images"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
	"golang.org/x/net/webdav"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestGetImage(t *testing.T) {
	testBytes := []byte("some test bytes")
	testPath := generateTestFile(t, testBytes)

	var (
		imageWithoutPath = models.Image{
			Token:     "test-token-no-path",
			URL:       "https://test.com",
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
		testImage = models.Image{
			Token:     "test-token",
			URL:       "https://test.com",
			Path:      testPath,
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
		testImageMissingFile = models.Image{
			Token:     "test-token-missing-file",
			URL:       "https://test.com",
			Path:      "/tmp/missing/1234asdf.png",
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
	)

	fakeImageStore := store.NewFakeImageStore(t, &imageWithoutPath, &testImage, &testImageMissingFile)
	store := newImageProvider(fakeImageStore, log.NewNopLogger())

	tests := []struct {
		name            string
		token           string
		url             string
		expImage        *alertingImages.Image
		expImageContent *alertingImages.ImageContent
		expRawDataErr   error
	}{
		{
			name:  "Given existing raw token, expect image",
			token: testImage.Token,
			expImage: &alertingImages.Image{
				URL: testImage.URL,
			},
		}, {
			name:  "Given existing token and url, expect image",
			token: testImage.Token,
			url:   testImage.URL,
			expImage: &alertingImages.Image{
				URL: testImage.URL,
			},
		}, {
			name:     "Given existing with just url, expect nil",
			token:    "",
			url:      testImage.URL,
			expImage: nil,
		}, {
			name:     "Given missing raw token, expect nil",
			token:    "invalid",
			expImage: nil,
		}, {
			name:  "Given image with Path, expect RawData",
			token: testImage.Token,
			expImage: &alertingImages.Image{
				URL: testImage.URL,
			},
			expImageContent: &alertingImages.ImageContent{
				Name:    filepath.Base(testImage.Path),
				Content: testBytes,
			},
		}, {
			name:  "Given image with Path but file doesn't exist, expect RawData error",
			token: testImageMissingFile.Token,
			expImage: &alertingImages.Image{
				URL: testImageMissingFile.URL,
			},
			expRawDataErr: models.ErrImageNotFound,
		}, {
			name:  "Given image without Path, expect RawData error",
			token: imageWithoutPath.Token,
			expImage: &alertingImages.Image{
				URL: imageWithoutPath.URL,
			},
			expRawDataErr: models.ErrImageDataUnavailable,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			alert := alertingNotify.Alert{
				Alert: model.Alert{
					Annotations: model.LabelSet{alertingModels.ImageTokenAnnotation: model.LabelValue(test.token)},
				},
			}
			image, err := store.GetImage(context.Background(), alert)
			require.NoError(tt, err)
			if test.expImage == nil {
				require.Nil(tt, image)
				return
			}
			require.Equal(tt, test.token, image.ID)
			require.Equal(tt, test.expImage.URL, image.URL)
			if test.expImageContent != nil {
				ic, err := image.RawData(context.Background())
				require.NoError(tt, err)
				require.Equal(tt, *test.expImageContent, ic)
			}
			if test.expRawDataErr != nil {
				_, err := image.RawData(context.Background())
				require.ErrorIs(tt, err, test.expRawDataErr)
			}
		})
	}
}

func TestPendingScreenshotIsSkippedUntilReady(t *testing.T) {
	ctx := context.Background()
	pending := models.Image{Token: "pending"}
	ready := models.Image{Token: "ready", URL: "https://example.com/ready.png"}
	images := store.NewFakeImageStore(t, &pending, &ready)
	provider := newImageProvider(images, log.NewNopLogger())
	alert := func(token string) *alertingNotify.Alert {
		return &alertingNotify.Alert{Alert: model.Alert{
			Annotations: model.LabelSet{alertingModels.ImageTokenAnnotation: model.LabelValue(token)},
		}}
	}
	pendingAlert := alert(pending.Token)
	got, err := provider.GetImage(ctx, *pendingAlert)
	require.NoError(t, err)
	require.Nil(t, got)
	var tokens []string
	err = alertingImages.WithStoredImages(ctx, log.NewNopLogger(), provider, func(_ int, image alertingImages.Image) error {
		tokens = append(tokens, image.ID)
		return nil
	}, pendingAlert, alert(ready.Token))
	require.NoError(t, err)
	require.Equal(t, []string{ready.Token}, tokens)

	pending.URL = "https://example.com/screenshot.png"
	require.NoError(t, images.SaveImage(ctx, &pending))
	got, err = provider.GetImage(ctx, *pendingAlert)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, pending.Token, got.ID)
	require.Equal(t, pending.URL, got.URL)
}

func TestIntegrationAsyncScreenshotWithExternalImageStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAlertingAsyncImageUpload)
	uploadStarted := make(chan struct{})
	release := make(chan struct{})
	var releaseOnce sync.Once
	releaseUpload := func() { releaseOnce.Do(func() { close(release) }) }
	defer releaseUpload()
	webdavHandler := &webdav.Handler{FileSystem: webdav.NewMemFS(), LockSystem: webdav.NewMemLS()}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPut {
			close(uploadStarted)
			<-release
		}
		webdavHandler.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)

	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.Enabled = new(true)
	cfg.UnifiedAlerting.Screenshots.Capture = true
	cfg.UnifiedAlerting.Screenshots.CaptureTimeout = 30 * time.Second
	cfg.UnifiedAlerting.Screenshots.MaxConcurrentScreenshots = 1
	cfg.UnifiedAlerting.Screenshots.UploadExternalImageStorage = true
	cfg.ImageUploadProvider = "webdav"
	cfg.Raw.Section("external_image_storage.webdav").Key("url").SetValue(server.URL)
	images, err := store.ProvideDBStore(db.NewTestStore(t, db.WithCfg(cfg)))
	require.NoError(t, err)
	screenshotPath, err := filepath.Abs("../../../../public/img/logo_transparent_400x.png")
	require.NoError(t, err)
	expectedBytes, err := os.ReadFile(screenshotPath)
	require.NoError(t, err)
	dashboardService := &dashboards.FakeDashboardService{}
	dashboardService.On("GetDashboard", mock.Anything, mock.Anything).
		Return(&dashboards.Dashboard{UID: "foo", Slug: "foo", OrgID: 1}, nil).Once()
	renderer := rendering.NewMockService(gomock.NewController(t))
	renderer.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any()).
		Return(&rendering.RenderResult{FilePath: screenshotPath}, nil)
	service, err := image.NewScreenshotImageServiceFromCfg(cfg, images, dashboardService, renderer, prometheus.NewRegistry())
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		require.NoError(t, service.Run(ctx))
	})

	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	callerCtx, cancelCaller := context.WithCancel(ctx)
	defer cancelCaller()
	result := make(chan *models.Image, 1)
	resultErr := make(chan error, 1)
	go func() {
		pending, err := service.NewImage(callerCtx, &models.AlertRule{OrgID: 1, DashboardUID: new("foo"), PanelID: new(int64(1))})
		resultErr <- err
		result <- pending
	}()
	var pending *models.Image
	select {
	case pending = <-result:
		require.NoError(t, <-resultErr)
	case <-ctx.Done():
		t.Fatal("NewImage blocked while the external image upload was pending")
	}
	require.NotEmpty(t, pending.Token)
	require.Empty(t, pending.URL)
	cancelCaller()
	select {
	case <-uploadStarted:
	case <-ctx.Done():
		t.Fatal("configured external image uploader was not called")
	}
	provider := newImageProvider(images, log.NewNopLogger())
	alert := alertingNotify.Alert{Alert: model.Alert{
		Annotations: model.LabelSet{alertingModels.ImageTokenAnnotation: model.LabelValue(pending.Token)},
	}}
	got, err := provider.GetImage(ctx, alert)
	require.NoError(t, err)
	require.Nil(t, got)
	releaseUpload()
	require.Eventually(t, func() bool {
		got, err = provider.GetImage(ctx, alert)
		return err == nil && got != nil && got.URL != ""
	}, 5*time.Second, 10*time.Millisecond)
	require.Equal(t, pending.Token, got.ID)
	require.Contains(t, got.URL, server.URL+"/")
	stored, err := images.GetImage(ctx, pending.Token)
	require.NoError(t, err)
	require.Equal(t, pending.ID, stored.ID)
	require.Equal(t, screenshotPath, stored.Path)
	require.Equal(t, got.URL, stored.URL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, got.URL, nil)
	require.NoError(t, err)
	res, err := server.Client().Do(req)
	require.NoError(t, err)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.Equal(t, http.StatusOK, res.StatusCode)
	actualBytes, err := io.ReadAll(res.Body)
	require.NoError(t, err)
	require.Equal(t, expectedBytes, actualBytes)
}

func generateTestFile(t *testing.T, b []byte) string {
	t.Helper()
	f, err := os.CreateTemp("", "image")
	require.NoError(t, err)
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(f.Name()))
	})

	_, err = f.Write(b)
	require.NoError(t, err)

	return f.Name()
}
