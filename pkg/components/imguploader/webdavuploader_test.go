package imguploader

import (
	"context"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToWebdav(t *testing.T) {

	// Can be tested with this docker container: https://hub.docker.com/r/morrisjobke/webdav/
	SkipConvey("[Integration test] for external_image_store.webdav", t, func() {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "")
		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldStartWith, "http://localhost:8888/webdav/")
	})

	SkipConvey("[Integration test] for external_image_store.webdav with public url", t, func() {
		webdavUploader, _ := NewWebdavImageUploader("http://localhost:8888/webdav/", "test", "test", "http://publicurl:8888/webdav")
		path, err := webdavUploader.Upload(context.Background(), "../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldStartWith, "http://publicurl:8888/webdav/")
	})
}
