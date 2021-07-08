package imguploader

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUploadToWebdav(t *testing.T) {
	// Can be tested with this docker container: https://hub.docker.com/r/morrisjobke/webdav/
	t.Run("[Integration test] for external_image_store.webdav", func(t *testing.T) {
		t.Skip("Skip test [Integration test] for external_image_store.webdav")
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "")
		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		require.NoError(t, err)
		require.True(t, strings.HasPrefix(path, "http://localhost:8888/webdav/"))
	})

	t.Run("[Integration test] for external_image_store.webdav with public url", func(t *testing.T) {
		t.Skip("Skip test [Integration test] for external_image_store.webdav with public url")
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://publicurl:8888/webdav")
		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		require.NoError(t, err)
		require.True(t, strings.HasPrefix(path, "http://publicurl:8888/webdav/"))

		require.True(t, strings.HasPrefix(path, "http://publicurl:8888/webdav/"))
	})
}

func TestPublicURL(t *testing.T) {
	t.Run("Given a public URL with parameters, and no template", func(t *testing.T) {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://cloudycloud.me/s/DOIFDOMV/download?files=")
		parsed, _ := url.Parse(webdavUploader.PublicURL("fileyfile.png"))
		require.True(t, strings.HasSuffix(parsed.Path, "fileyfile.png"))
	})
	t.Run("Given a public URL with parameters, and a template", func(t *testing.T) {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://cloudycloud.me/s/DOIFDOMV/download?files=${file}")
		require.True(t, strings.HasSuffix(webdavUploader.PublicURL("fileyfile.png"), "fileyfile.png"))
	})
}
