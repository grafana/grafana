package notifier

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	alertingImages "github.com/grafana/alerting/images"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestGetImage(t *testing.T) {
	fakeImageStore := store.NewFakeImageStore(t)
	store := newImageProvider(fakeImageStore, log.NewNopLogger())

	t.Run("queries by token when it gets a token", func(tt *testing.T) {
		img := models.Image{
			Token: "test",
			URL:   "http://localhost:1234",
			Path:  "test.png",
		}
		err := fakeImageStore.SaveImage(context.Background(), &img)
		require.NoError(tt, err)

		// nolint:staticcheck
		savedImg, err := store.GetImage(context.Background(), "token://"+img.Token)
		require.NoError(tt, err)
		require.Equal(tt, savedImg.Token, img.Token)
		require.Equal(tt, savedImg.URL, img.URL)
		require.Equal(tt, savedImg.Path, img.Path)
	})

	t.Run("queries by URL when it gets a URL", func(tt *testing.T) {
		img := models.Image{
			Token: "test",
			Path:  "test.png",
			URL:   "https://test.com/test.png",
		}
		err := fakeImageStore.SaveImage(context.Background(), &img)
		require.NoError(tt, err)

		// nolint:staticcheck
		savedImg, err := store.GetImage(context.Background(), img.URL)
		require.NoError(tt, err)
		require.Equal(tt, savedImg.Token, img.Token)
		require.Equal(tt, savedImg.URL, img.URL)
		require.Equal(tt, savedImg.Path, img.Path)
	})
}

func TestGetImageURL(t *testing.T) {
	var (
		imageWithoutURL = models.Image{
			Token:     "test-no-url",
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
		testImage = models.Image{
			Token:     "test",
			URL:       "https://test.com",
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
	)

	fakeImageStore := store.NewFakeImageStore(t, &imageWithoutURL, &testImage)
	store := newImageProvider(fakeImageStore, log.NewNopLogger())

	tests := []struct {
		name   string
		uri    string
		expURL string
		expErr error
	}{
		{
			"URL does not exist",
			"https://invalid.com/test",
			"",
			alertingImages.ErrImageNotFound,
		}, {
			"existing URL",
			testImage.URL,
			testImage.URL,
			nil,
		}, {
			"token does not exist",
			"token://invalid",
			"",
			alertingImages.ErrImageNotFound,
		}, {
			"existing token",
			"token://" + testImage.Token,
			testImage.URL,
			nil,
		}, {
			"image has no URL",
			"token://" + imageWithoutURL.Token,
			"",
			alertingImages.ErrImagesNoURL,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			alert := alertingNotify.Alert{
				Alert: model.Alert{
					Annotations: model.LabelSet{alertingModels.ImageTokenAnnotation: model.LabelValue(test.uri)},
				},
			}
			url, err := store.GetImageURL(context.Background(), &alert)
			require.ErrorIs(tt, err, test.expErr)
			require.Equal(tt, test.expURL, url)
		})
	}
}

func TestGetRawImage(t *testing.T) {
	var (
		testBytes        = []byte("some test bytes")
		testPath         = generateTestFile(t, testBytes)
		imageWithoutPath = models.Image{
			Token:     "test-no-path",
			URL:       "https://test-no-path.com",
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
		testImage = models.Image{
			Token:     "test",
			URL:       "https://test.com",
			Path:      testPath,
			CreatedAt: time.Now().UTC(),
			ExpiresAt: time.Now().UTC().Add(24 * time.Hour),
		}
	)

	fakeImageStore := store.NewFakeImageStore(t, &imageWithoutPath, &testImage)
	store := newImageProvider(fakeImageStore, log.NewNopLogger())

	tests := []struct {
		name        string
		uri         string
		expFilename string
		expBytes    []byte
		expErr      error
	}{
		{
			"URL does not exist",
			"https://invalid.com/test",
			"",
			nil,
			alertingImages.ErrImageNotFound,
		}, {
			"existing URL",
			testImage.URL,
			filepath.Base(testPath),
			testBytes,
			nil,
		}, {
			"token does not exist",
			"token://invalid",
			"",
			nil,
			alertingImages.ErrImageNotFound,
		}, {
			"existing token",
			"token://" + testImage.Token,
			filepath.Base(testPath),
			testBytes,
			nil,
		}, {
			"image has no path",
			"token://" + imageWithoutPath.Token,
			"",
			nil,
			alertingImages.ErrImagesNoPath,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			alert := alertingNotify.Alert{
				Alert: model.Alert{
					Annotations: model.LabelSet{alertingModels.ImageTokenAnnotation: model.LabelValue(test.uri)},
				},
			}
			readCloser, filename, err := store.GetRawImage(context.Background(), &alert)
			require.ErrorIs(tt, err, test.expErr)
			require.Equal(tt, test.expFilename, filename)

			if test.expBytes != nil {
				b, err := io.ReadAll(readCloser)
				require.NoError(tt, err)
				require.Equal(tt, test.expBytes, b)
				require.NoError(t, readCloser.Close())
			}
		})
	}
}

func generateTestFile(t *testing.T, b []byte) string {
	t.Helper()
	f, err := os.CreateTemp("/tmp", "image")
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
