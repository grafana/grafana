package imguploader

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestUploadToQiniu(t *testing.T) {
	SkipConvey("[Integration test] for external_image_store.qiniu", t, func() {

		qiniuUploader := NewQiniuUploader("<bucketName>", "<ak>", "<sk>")

		path, err := qiniuUploader.Upload("../../../public/img/logo_transparent_400x.png")

		So(err, ShouldBeNil)
		So(path, ShouldNotEqual, "")
	})
}
