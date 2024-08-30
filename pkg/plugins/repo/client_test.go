package repo

import (
	"archive/zip"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/stretchr/testify/require"
)

func writeFakeZip(w http.ResponseWriter) error {
	ww := zip.NewWriter(w)
	_, err := ww.Create("test.txt")
	if err != nil {
		return err
	}
	return ww.Close()
}

func Test_Download(t *testing.T) {
	t.Run("it should download a file", func(t *testing.T) {
		fakeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			err := writeFakeZip(w)
			require.NoError(t, err)
		}))
		defer fakeServer.Close()
		cli := fakeServer.Client()
		repo := Client{httpClient: *cli, httpClientNoTimeout: *cli, log: log.NewPrettyLogger("test")}
		_, err := repo.Download(context.Background(), fakeServer.URL, "", CompatOpts{})
		require.NoError(t, err)
	})

	t.Run("it should set the origin header", func(t *testing.T) {
		var origin string
		fakeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin = r.Header.Get("grafana-origin")
			err := writeFakeZip(w)
			require.NoError(t, err)
		}))
		defer fakeServer.Close()
		cli := fakeServer.Client()
		repo := Client{httpClient: *cli, httpClientNoTimeout: *cli, log: log.NewPrettyLogger("test")}
		ctx := WithRequestOrigin(context.Background(), "test")
		_, err := repo.Download(ctx, fakeServer.URL, "", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, "test", origin, "origin header should be set")
	})

	t.Run("it should retry on error", func(t *testing.T) {
		var count int
		fakeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			count++
			if count < 2 {
				http.Error(w, "error", http.StatusInternalServerError)
				return
			}
			retryCount := r.Header.Get("grafana-retrycount")
			require.Equal(t, "2", retryCount, "retry count should be set")
			err := writeFakeZip(w)
			require.NoError(t, err)
		}))
		defer fakeServer.Close()
		cli := fakeServer.Client()
		repo := Client{httpClient: *cli, httpClientNoTimeout: *cli, log: log.NewPrettyLogger("test"), retryCount: 1}
		_, err := repo.Download(context.Background(), fakeServer.URL, "", CompatOpts{})
		require.NoError(t, err)
		require.Equal(t, 2, count, "should retry on error")
	})
}
