package imguploader

import (
	"context"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUploadToWebdav(t *testing.T) {
	// Can be tested with this docker container: https://hub.docker.com/r/morrisjobke/webdav/
	Skipt.Run("[Integration test] for external_image_store.webdav", func(t *testing.T) {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "")
		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		require.NoError(t, err)
		So(path, ShouldStartWith, "http://localhost:8888/webdav/")
	})

	Skipt.Run("[Integration test] for external_image_store.webdav with public url", func(t *testing.T) {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://publicurl:8888/webdav")
		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		require.NoError(t, err)
		So(path, ShouldStartWith, "http://publicurl:8888/webdav/")
	})
}

func TestPublicURL(t *testing.T) {
	t.Run("Given a public URL with parameters, and no template", func(t *testing.T) {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://cloudycloud.me/s/DOIFDOMV/download?files=")
		parsed, _ := url.Parse(webdavUploader.PublicURL("fileyfile.png"))
		So(parsed.Path, ShouldEndWith, "fileyfile.png")
	})
	t.Run("Given a public URL with parameters, and a template", func(t *testing.T) {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://cloudycloud.me/s/DOIFDOMV/download?files=${file}")
		So(webdavUploader.PublicURL("fileyfile.png"), ShouldEndWith, "fileyfile.png")
	})
}
