package imguploader

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/net/webdav"
)

func TestUploadToWebdav(t *testing.T) {
	t.Parallel()

	t.Run("[Integration test] for external_image_store.webdav", func(t *testing.T) {
		t.Parallel()

		handler := &webdav.Handler{
			FileSystem: webdav.Dir(t.TempDir()),
			LockSystem: webdav.NewMemLS(),
			Logger: func(r *http.Request, err error) {
				require.Equal(t, http.MethodPut, r.Method)
				require.NoError(t, err)
			},
		}

		server := httptest.NewServer(handler)
		t.Cleanup(server.Close)

		webdavUploader, err := NewWebdavImageUploader(server.URL, "test", "test", "")
		require.NoError(t, err)
		require.NotNil(t, webdavUploader)

		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")
		require.NoError(t, err)
		require.True(t, strings.HasPrefix(path, server.URL))
	})

	t.Run("[Integration test] for external_image_store.webdav with public url", func(t *testing.T) {
		t.Parallel()

		handler := &webdav.Handler{
			FileSystem: webdav.Dir(t.TempDir()),
			LockSystem: webdav.NewMemLS(),
			Logger: func(r *http.Request, err error) {
				require.Equal(t, http.MethodPut, r.Method)
				require.NoError(t, err)
			},
		}

		server := httptest.NewServer(handler)
		t.Cleanup(server.Close)

		webdavUploader, err := NewWebdavImageUploader(server.URL, "test", "test", "http://publicurl:8888/webdav")
		require.NoError(t, err)
		require.NotNil(t, webdavUploader)

		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")
		require.NoError(t, err)
		require.True(t, strings.HasPrefix(path, "http://publicurl:8888/webdav/"))
	})
}

func TestPublicURL(t *testing.T) {
	t.Parallel()

	t.Run("Given a public URL with parameters, and no template", func(t *testing.T) {
		t.Parallel()

		webdavUploader, err := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://cloudycloud.me/s/DOIFDOMV/download?files=")
		require.NoError(t, err)
		require.Equal(t, "http://cloudycloud.me/s/DOIFDOMV/download/fileyfile.png?files=", webdavUploader.PublicURL("fileyfile.png"))
	})

	t.Run("Given a public URL with parameters, and a template", func(t *testing.T) {
		t.Parallel()

		webdavUploader, err := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://cloudycloud.me/s/DOIFDOMV/download?files={{file}}")
		require.NoError(t, err)
		require.Equal(t, "http://cloudycloud.me/s/DOIFDOMV/download?files=fileyfile.png", webdavUploader.PublicURL("fileyfile.png"))
	})
}
