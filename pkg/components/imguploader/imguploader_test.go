package imguploader

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestImageUploaderFactory(t *testing.T) {
	Convey("Can create image uploader for ", t, func() {
		Convey("S3ImageUploader", func() {
			var err error
			setting.NewConfigContext(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "s3"

			s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
			s3sec.NewKey("bucket_url", "bucket_url")
			s3sec.NewKey("access_key", "access_key")
			s3sec.NewKey("secret_key", "secret_key")

			uploader, err := NewImageUploader()

			So(err, ShouldBeNil)
			So(reflect.TypeOf(uploader), ShouldEqual, reflect.TypeOf(&S3Uploader{}))
		})

		Convey("Webdav uploader", func() {
			var err error

			setting.NewConfigContext(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "webdav"

			webdavSec, err := setting.Cfg.GetSection("external_image_storage.webdav")
			webdavSec.NewKey("url", "webdavUrl")
			webdavSec.NewKey("username", "username")
			webdavSec.NewKey("password", "password")

			uploader, err := NewImageUploader()

			So(err, ShouldBeNil)
			So(reflect.TypeOf(uploader), ShouldEqual, reflect.TypeOf(&WebdavUploader{}))
		})
	})
}
