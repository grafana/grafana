package imguploader

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToWebdav(t *testing.T) {
	webdavUploader, _ := NewWebdavImageUploader("http://localhost:9998/dav/", "username", "password")

	SkipConvey("[Integration test] for external_image_store.webdav", t, func() {
		path, err := webdavUploader.Upload("../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldNotEqual, "")
	})
}
