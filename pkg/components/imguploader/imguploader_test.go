package imguploader

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestImageUploaderFactory(t *testing.T) {
	Convey("Can create image uploader for ", t, func() {
		Convey("S3ImageUploader config", func() {
			setting.NewConfigContext(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "s3"

			Convey("with bucket url https://foo.bar.baz.s3-us-east-2.amazonaws.com", func() {
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

			Convey("with bucket url https://s3.amazonaws.com/mybucket", func() {
				s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
				s3sec.NewKey("bucket_url", "https://s3.amazonaws.com/my.bucket.com")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "us-east-1")
				So(original.bucket, ShouldEqual, "my.bucket.com")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})

			Convey("with bucket url https://s3-us-west-2.amazonaws.com/mybucket", func() {
				s3sec, err := setting.Cfg.GetSection("external_image_storage.s3")
				s3sec.NewKey("bucket_url", "https://s3-us-west-2.amazonaws.com/my.bucket.com")
				s3sec.NewKey("access_key", "access_key")
				s3sec.NewKey("secret_key", "secret_key")

				uploader, err := NewImageUploader()

				So(err, ShouldBeNil)
				original, ok := uploader.(*S3Uploader)

				So(ok, ShouldBeTrue)
				So(original.region, ShouldEqual, "us-west-2")
				So(original.bucket, ShouldEqual, "my.bucket.com")
				So(original.accessKey, ShouldEqual, "access_key")
				So(original.secretKey, ShouldEqual, "secret_key")
			})
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

		Convey("GCS uploader", func() {
			var err error

			setting.NewConfigContext(&setting.CommandLineArgs{
				HomePath: "../../../",
			})

			setting.ImageUploadProvider = "gcs"

			gcpSec, err := setting.Cfg.GetSection("external_image_storage.gcs")
			gcpSec.NewKey("key_file", "/etc/secrets/project-79a52befa3f6.json")
			gcpSec.NewKey("bucket", "project-grafana-east")

			uploader, err := NewImageUploader()

			So(err, ShouldBeNil)
			original, ok := uploader.(*GCSUploader)

			So(ok, ShouldBeTrue)
			So(original.keyFile, ShouldEqual, "/etc/secrets/project-79a52befa3f6.json")
			So(original.bucket, ShouldEqual, "project-grafana-east")
		})
	})
}
