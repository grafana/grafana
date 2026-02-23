package notifier

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	alertingImages "github.com/grafana/alerting/images"
	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
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
