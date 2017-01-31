package imguploader

import (
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
			s3sec.NewKey("bucket_url", "https://foo.bar.baz.s3-us-east-2.amazonaws.com")
			s3sec.NewKey("access_key", "access_key")
			s3sec.NewKey("secret_key", "secret_key")

			uploader, err := NewImageUploader()

			So(err, ShouldBeNil)
			original, ok := uploader.(*S3Uploader)

			So(ok, ShouldBeTrue)
			So(original.region, ShouldEqual, "us-east-2")
			So(original.bucket, ShouldEqual, "foo.bar.baz")
			So(original.accessKey, ShouldEqual, "access_key")
			So(original.secretKey, ShouldEqual, "secret_key")
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
			original, ok := uploader.(*WebdavUploader)

			So(ok, ShouldBeTrue)
			So(original.url, ShouldEqual, "webdavUrl")
			So(original.username, ShouldEqual, "username")
			So(original.password, ShouldEqual, "password")
		})
	})
}
