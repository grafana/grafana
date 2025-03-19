package objectstorage

import (
	"bytes"
	"context"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"
)

func TestPresignedURLUpload(t *testing.T) {
	t.Parallel()

	t.Run("successfully send data to the server", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		key := "snapshot/uuid/key"
		data := "sending-some-data"

		reader := bytes.NewBufferString(data)

		qs, err := url.ParseQuery("one=a&two=b")
		require.NoError(t, err)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			contentType := r.Header.Get("Content-Type")
			_, boundary, found := strings.Cut(contentType, "boundary=")
			require.True(t, found)

			mpr := multipart.NewReader(r.Body, boundary)

			form, err := mpr.ReadForm(math.MaxInt64)
			require.NoError(t, err)
			require.NotNil(t, form)
			require.NotNil(t, form.Value)

			require.Equal(t, key, form.Value["key"][0])
			require.Equal(t, qs.Get("one"), form.Value["one"][0])
			require.Equal(t, qs.Get("two"), form.Value["two"][0])

			require.Len(t, form.File, 1)
			require.Len(t, form.File["file"], 1)

			fileHeader := form.File["file"][0]
			require.Equal(t, "file", fileHeader.Filename)

			file, err := fileHeader.Open()
			require.NoError(t, err)

			contents, err := io.ReadAll(file)
			require.NoError(t, err)
			require.EqualValues(t, data, string(contents))

			require.NoError(t, file.Close())
		}))
		t.Cleanup(server.Close)

		s3 := NewS3(http.DefaultClient, tracing.NewNoopTracerService())

		presignedURL, err := url.Parse(server.URL + "?" + qs.Encode())
		require.NoError(t, err)

		err = s3.PresignedURLUpload(ctx, presignedURL.String(), key, reader)
		require.NoError(t, err)
	})

	t.Run("when the request to the server returns an error, it is propagated", func(t *testing.T) {
		t.Parallel()

		ctx := context.Background()

		key := "snapshot/uuid/key"
		data := "sending-some-data"

		reader := bytes.NewBufferString(data)

		body := "test error"
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message": "` + body + `}`))
		}))
		t.Cleanup(server.Close)

		s3 := NewS3(http.DefaultClient, tracing.NewNoopTracerService())

		presignedURL, err := url.Parse(server.URL)
		require.NoError(t, err)

		err = s3.PresignedURLUpload(ctx, presignedURL.String(), key, reader)
		require.Error(t, err)
		require.Contains(t, err.Error(), body)
	})
}
