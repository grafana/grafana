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

	t.Run("it should use gcom token when the token is available and request is to GCOM", func(t *testing.T) {
		expectedToken := "token-test"
		var gcomCalled bool
		fakeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			require.Equal(t, "Bearer "+expectedToken, token, "gcom token should be set")
			err := writeFakeZip(w)
			require.NoError(t, err)
			gcomCalled = true
		}))
		defer fakeServer.Close()
		cli := fakeServer.Client()
		pluginURL := fakeServer.URL + "/api/plugins/test-datasource"
		gcomAPIURL := fakeServer.URL + "/api/plugins"
		repo := Client{httpClient: *cli, httpClientNoTimeout: *cli, log: log.NewPrettyLogger("test"), grafanaComAPIToken: expectedToken, grafanaComAPIURL: gcomAPIURL}
		_, err := repo.Download(context.Background(), pluginURL, "", CompatOpts{})
		require.NoError(t, err)
		require.True(t, gcomCalled)
	})

	t.Run("it should not set gcom token when the token is available but request is NOT to GCOM", func(t *testing.T) {
		expectedToken := "token-test"
		var serverCalled bool
		fakeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			require.Empty(t, token, "token should not be set")
			err := writeFakeZip(w)
			require.NoError(t, err)
			serverCalled = true
		}))
		defer fakeServer.Close()
		cli := fakeServer.Client()
		repo := Client{httpClient: *cli, httpClientNoTimeout: *cli, log: log.NewPrettyLogger("test"), grafanaComAPIToken: expectedToken, grafanaComAPIURL: "https://grafana.com/api/plugins"}
		_, err := repo.Download(context.Background(), fakeServer.URL, "", CompatOpts{})
		require.NoError(t, err)
		require.True(t, serverCalled)
	})
}
